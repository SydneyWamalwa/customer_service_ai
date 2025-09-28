/**
 * FAQManager - Manages FAQ training and reasoning for the AI agent
 * Handles storing, retrieving, and reasoning with FAQ data
 */
export class FAQManager {
  constructor(env, vectorManager) {
    this.env = env;
    this.vectorManager = vectorManager;
    this.faqNamespace = 'faqs';
  }

  /**
   * Train the AI with new FAQ data
   * @param {Array} faqItems - Array of FAQ items with question and answer
   * @param {string} companyId - The company ID for namespacing
   */
  async trainWithFAQs(faqItems, companyId) {
    const namespace = `${companyId}-${this.faqNamespace}`;
    const results = [];

    for (const item of faqItems) {
      // Store both question and answer as separate entries for better matching
      const questionResult = await this.vectorManager.storeKnowledge(
        item.question,
        {
          type: 'faq-question',
          answer: item.answer,
          category: item.category || 'general',
          companyId
        },
        namespace
      );

      const answerResult = await this.vectorManager.storeKnowledge(
        item.answer,
        {
          type: 'faq-answer',
          question: item.question,
          category: item.category || 'general',
          companyId
        },
        namespace
      );

      results.push({
        question: item.question,
        questionId: questionResult.id,
        answerId: answerResult.id
      });
    }

    return {
      success: true,
      message: `Successfully trained with ${faqItems.length} FAQ items`,
      results
    };
  }

  /**
   * Retrieve relevant FAQs for a given query
   * @param {string} query - The user query
   * @param {string} companyId - The company ID for namespacing
   * @param {number} limit - Maximum number of results to return
   */
  async getRelevantFAQs(query, companyId, limit = 5) {
    const namespace = `${companyId}-${this.faqNamespace}`;
    const results = await this.vectorManager.searchKnowledge(query, namespace, limit);
    
    // Format the results for easy consumption
    return results.map(result => ({
      question: result.metadata.type === 'faq-question' ? result.metadata.text : result.metadata.question,
      answer: result.metadata.type === 'faq-answer' ? result.metadata.text : result.metadata.answer,
      category: result.metadata.category,
      score: result.score
    }));
  }

  /**
   * Reason with FAQs to generate a response
   * @param {string} query - The user query
   * @param {string} companyId - The company ID for namespacing
   */
  async reasonWithFAQs(query, companyId) {
    // Get relevant FAQs
    const relevantFAQs = await this.getRelevantFAQs(query, companyId, 3);
    
    if (relevantFAQs.length === 0) {
      return {
        hasRelevantInfo: false,
        response: null,
        reasoning: "No relevant FAQ information found"
      };
    }

    // Prepare context for reasoning
    const faqContext = relevantFAQs.map((faq, index) => 
      `FAQ ${index + 1}:\nQ: ${faq.question}\nA: ${faq.answer}`
    ).join('\n\n');

    // Use AI to reason and generate a response
    const reasoningPrompt = `
You are a customer support AI assistant. Based on the following FAQs and the customer's question, 
provide a helpful response. If the FAQs don't contain relevant information, acknowledge that.

Customer Question: ${query}

Relevant FAQs:
${faqContext}

First, analyze if these FAQs are relevant to the customer's question.
Then, formulate a helpful response using the information from the FAQs.
If the FAQs don't address the question, acknowledge that you don't have the specific information.
`;

    const aiResponse = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: reasoningPrompt }]
    });

    // Extract reasoning and response
    const responseContent = aiResponse.response.content;
    
    return {
      hasRelevantInfo: true,
      response: responseContent,
      reasoning: `Based on ${relevantFAQs.length} relevant FAQs with highest match score of ${Math.max(...relevantFAQs.map(faq => faq.score)).toFixed(2)}`,
      relevantFAQs
    };
  }
}