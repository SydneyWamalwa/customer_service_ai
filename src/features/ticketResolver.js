/**
 * TicketResolver - Handles support ticket resolution with reasoning and actions
 * Manages the process of analyzing, reasoning about, and resolving customer support tickets
 */
export class TicketResolver {
  constructor(env, vectorManager, toolRegistry) {
    this.env = env;
    this.vectorManager = vectorManager;
    this.toolRegistry = toolRegistry;
    this.ticketNamespace = 'tickets';
  }

  /**
   * Analyze a support ticket and determine appropriate actions
   * @param {object} ticket - The support ticket object
   * @param {string} companyId - The company ID
   */
  async analyzeTicket(ticket, companyId) {
    // Prepare the analysis prompt
    const analysisPrompt = `
You are a customer support AI assistant analyzing a support ticket.
Based on the ticket details, determine:
1. The main issue category
2. Required actions to resolve the issue
3. Whether human approval is needed before taking action
4. Confidence level in your analysis (0-100)

Ticket: ${ticket.description}
Customer ID: ${ticket.customerId}
Priority: ${ticket.priority || 'Normal'}
`;

    // Use AI to analyze the ticket
    const analysis = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: analysisPrompt }]
    });

    // Parse the analysis to extract structured information
    const analysisText = analysis.response.content;
    
    // Extract key information using simple parsing
    const categoryMatch = analysisText.match(/category:?\s*([^\n]+)/i);
    const actionsMatch = analysisText.match(/actions:?\s*([^\n]+)/i);
    const approvalMatch = analysisText.match(/approval:?\s*(yes|no)/i);
    const confidenceMatch = analysisText.match(/confidence:?\s*(\d+)/i);

    return {
      ticketId: ticket.id,
      category: categoryMatch ? categoryMatch[1].trim() : 'Uncategorized',
      suggestedActions: actionsMatch ? actionsMatch[1].trim() : 'No specific actions suggested',
      requiresApproval: approvalMatch ? approvalMatch[1].toLowerCase() === 'yes' : true,
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 50,
      rawAnalysis: analysisText
    };
  }

  /**
   * Resolve a ticket by taking appropriate actions
   * @param {object} ticket - The support ticket object
   * @param {object} analysis - The ticket analysis
   * @param {boolean} approved - Whether the resolution is approved
   * @param {string} companyId - The company ID
   */
  async resolveTicket(ticket, analysis, approved, companyId) {
    // If not approved, return early
    if (analysis.requiresApproval && !approved) {
      return {
        ticketId: ticket.id,
        status: 'pending_approval',
        message: 'Ticket resolution requires approval'
      };
    }

    // Determine which tools to use based on the analysis
    const toolsToUse = this.determineTools(analysis);
    const toolResults = {};

    // Execute each tool
    for (const tool of toolsToUse) {
      if (this.toolRegistry[tool.name]) {
        try {
          toolResults[tool.name] = await this.toolRegistry[tool.name].execute(tool.params);
        } catch (error) {
          toolResults[tool.name] = { error: error.message };
        }
      }
    }

    // Generate resolution response
    const resolutionPrompt = `
You are a customer support AI assistant resolving a ticket.
Based on the ticket details and the actions taken, provide a resolution response to the customer.

Ticket: ${ticket.description}
Analysis: ${analysis.rawAnalysis}
Actions Taken: ${JSON.stringify(toolResults)}

Provide a clear, helpful response explaining what was done to resolve the issue.
`;

    const resolution = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: resolutionPrompt }]
    });

    // Store the resolution in vector database for future reference
    await this.storeTicketResolution(ticket, analysis, toolResults, resolution.response.content, companyId);

    return {
      ticketId: ticket.id,
      status: 'resolved',
      message: resolution.response.content,
      actions: toolResults
    };
  }

  /**
   * Determine which tools to use based on ticket analysis
   * @param {object} analysis - The ticket analysis
   */
  determineTools(analysis) {
    // This is a simplified implementation
    // In a real system, you would have more sophisticated logic to map
    // ticket categories and suggested actions to specific tools
    
    const toolsMap = {
      'account': [{ name: 'accountLookup', params: {} }],
      'billing': [{ name: 'billingCheck', params: {} }],
      'technical': [{ name: 'technicalDiagnostic', params: {} }],
      'product': [{ name: 'productInfo', params: {} }]
    };
    
    // Extract category from analysis
    const category = analysis.category.toLowerCase();
    
    // Find matching tools or return empty array
    for (const [key, tools] of Object.entries(toolsMap)) {
      if (category.includes(key)) {
        return tools;
      }
    }
    
    return [];
  }

  /**
   * Store ticket resolution in vector database for future reference
   * @param {object} ticket - The ticket object
   * @param {object} analysis - The ticket analysis
   * @param {object} actions - The actions taken
   * @param {string} resolution - The resolution message
   * @param {string} companyId - The company ID
   */
  async storeTicketResolution(ticket, analysis, actions, resolution, companyId) {
    const namespace = `${companyId}-${this.ticketNamespace}`;
    
    // Create a document that combines all relevant information
    const document = `
Ticket ID: ${ticket.id}
Customer ID: ${ticket.customerId}
Issue: ${ticket.description}
Category: ${analysis.category}
Actions Taken: ${JSON.stringify(actions)}
Resolution: ${resolution}
`;

    // Store in vector database
    await this.vectorManager.storeKnowledge(
      document,
      {
        type: 'ticket-resolution',
        ticketId: ticket.id,
        customerId: ticket.customerId,
        category: analysis.category,
        companyId
      },
      namespace
    );
  }

  /**
   * Find similar past resolutions to help with current ticket
   * @param {object} ticket - The current ticket
   * @param {string} companyId - The company ID
   */
  async findSimilarResolutions(ticket, companyId) {
    const namespace = `${companyId}-${this.ticketNamespace}`;
    
    // Search for similar resolutions
    const results = await this.vectorManager.searchKnowledge(
      ticket.description,
      namespace,
      3
    );
    
    return results.map(result => ({
      ticketId: result.metadata.ticketId,
      category: result.metadata.category,
      resolution: result.metadata.text,
      similarity: result.score
    }));
  }
}