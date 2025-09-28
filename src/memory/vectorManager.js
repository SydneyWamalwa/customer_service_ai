/**
 * VectorManager - Manages vector embeddings and semantic search
 * Handles storing, retrieving, and searching knowledge in Vectorize DB
 * Enhanced with memory capabilities for recalling previous customer interactions
 */
export class VectorManager {
  constructor(env) {
    this.env = env;
    this.vectorizeIndex = env.VECTORIZE_INDEX;
    this.interactionNamespace = 'interactions';
  }

  /**
   * Store knowledge in the vector database
   * @param {string} text - The text to store
   * @param {Object} metadata - Additional metadata about the text
   * @param {string} namespace - The company namespace to store in
   */
  async storeKnowledge(text, metadata, namespace) {
    try {
      // Generate embedding for the text
      const embedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: text
      });
      
      // Store in Vectorize with the embedding
      const id = crypto.randomUUID();
      await this.vectorizeIndex.insert({
        id,
        values: embedding.data[0],
        metadata: {
          ...metadata,
          text,
          timestamp: new Date().toISOString()
        }
      }, { namespace });
      
      return { success: true, id };
    } catch (error) {
      console.error('Error storing knowledge:', error);
      throw error;
    }
  }

  /**
   * Store customer interaction in memory
   * @param {string} customerId - The customer ID
   * @param {string} query - The customer query
   * @param {string} response - The agent response
   * @param {object} context - Additional context (actions taken, etc.)
   * @param {string} companyId - The company ID
   */
  async storeInteraction(customerId, query, response, context, companyId) {
    const namespace = `${companyId}-${this.interactionNamespace}`;
    
    // Create a document that combines the interaction details
    const interactionText = `
Customer: ${query}
Agent: ${response}
Actions: ${JSON.stringify(context.actions || {})}
Resolution: ${context.resolution || 'N/A'}
`;

    return await this.storeKnowledge(
      interactionText,
      {
        type: 'customer-interaction',
        customerId,
        query,
        response,
        actions: context.actions,
        resolution: context.resolution,
        timestamp: new Date().toISOString()
      },
      namespace
    );
  }

  /**
   * Recall similar previous interactions for a customer
   * @param {string} customerId - The customer ID
   * @param {string} query - The current query
   * @param {string} companyId - The company ID
   * @param {number} limit - Maximum number of interactions to recall
   */
  async recallCustomerInteractions(customerId, query, companyId, limit = 3) {
    const namespace = `${companyId}-${this.interactionNamespace}`;
    
    // Search for similar interactions by this customer
    const results = await this.searchKnowledge(
      query,
      namespace,
      limit,
      { filter: { customerId } }
    );
    
    return results.map(result => ({
      query: result.metadata.query,
      response: result.metadata.response,
      actions: result.metadata.actions,
      resolution: result.metadata.resolution,
      timestamp: result.metadata.timestamp,
      similarity: result.score
    }));
  }

  /**
   * Search for relevant knowledge
   * @param {string} query - The search query
   * @param {string} namespace - The company namespace to search in
   * @param {number} limit - Maximum number of results to return
   * @param {object} options - Additional search options (filters, etc.)
   */
  async searchKnowledge(query, namespace, limit = 5, options = {}) {
    try {
      // Generate embedding for the query
      const embedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: query
      });
      
      // Search for similar vectors
      const results = await this.vectorizeIndex.query(embedding.data[0], {
        namespace,
        topK: limit
      });
      
      return results;
    } catch (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }
  }

  /**
   * Delete knowledge from the vector database
   * @param {string} id - The ID of the knowledge to delete
   * @param {string} namespace - The company namespace
   */
  async deleteKnowledge(id, namespace) {
    try {
      await this.vectorizeIndex.delete([id], { namespace });
      return { success: true };
    } catch (error) {
      console.error('Error deleting knowledge:', error);
      throw error;
    }
  }

  /**
   * Batch import knowledge
   * @param {Array} items - Array of {text, metadata} objects
   * @param {string} namespace - The company namespace
   */
  async batchImport(items, namespace) {
    const results = [];
    
    for (const item of items) {
      try {
        const result = await this.storeKnowledge(item.text, item.metadata, namespace);
        results.push({ success: true, id: result.id });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }
}