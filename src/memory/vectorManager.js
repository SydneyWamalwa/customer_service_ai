/**
 * VectorManager - Manages vector embeddings and semantic search
 * Handles storing, retrieving, and searching knowledge in Vectorize DB
 */
export class VectorManager {
  constructor(env) {
    this.env = env;
    this.vectorizeIndex = env.VECTORIZE_INDEX;
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
   * Search for relevant knowledge
   * @param {string} query - The search query
   * @param {string} namespace - The company namespace to search in
   * @param {number} limit - Maximum number of results to return
   */
  async searchKnowledge(query, namespace, limit = 5) {
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