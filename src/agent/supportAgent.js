/**
 * SupportAgent - Core agent class for multi-tenant customer support
 * Handles message processing, tool invocation, and context management
 */
import { VectorManager } from '../memory/vectorManager';
import { FAQManager } from '../features/faqManager';
import { TicketResolver } from '../features/ticketResolver';
import { EscalationManager } from '../features/escalation';
export class SupportAgent {
  constructor({ env, companyConfig, userId, sessionId }) {
    this.env = env;
    this.companyConfig = companyConfig;
    this.userId = userId || 'anonymous';
    this.sessionId = sessionId || crypto.randomUUID();
    this.vectorNamespace = companyConfig.vectorNamespace || `company-${companyConfig.id}`;
    this.toolRegistry = this.registerTools(companyConfig.tools || []);
  }

  /**
   * Register company-specific tools
   */
  registerTools(toolConfigs) {
    const registry = {};
    
    toolConfigs.forEach(tool => {
      registry[tool.name] = {
        ...tool,
        execute: async (params) => {
          // If the tool has a custom handler function defined
          if (tool.handlerFunction && typeof tool.handlerFunction === 'function') {
            return await tool.handlerFunction(params, this.companyConfig, this.env);
          }
          
          // If the tool has a webhook URL defined
          if (tool.webhookUrl) {
            const response = await fetch(tool.webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Company-ID': this.companyConfig.id,
                'X-User-ID': this.userId,
                'Authorization': `Bearer ${tool.apiKey || this.companyConfig.apiKey || ''}`
              },
              body: JSON.stringify({
                tool: tool.name,
                params,
                userId: this.userId,
                sessionId: this.sessionId
              })
            });
            
            return await response.json();
          }
          
          // Default response if no handler or webhook is defined
          return { error: 'Tool execution method not defined' };
        }
      };
    });
    
    return registry;
  }

  /**
   * Process an incoming message and generate a response
   */
  async processMessage(message) {
    // Get or create chat session from Durable Object
    const sessionId = this.sessionId;
    const sessionObjectId = this.env.CHAT_SESSIONS.idFromName(sessionId);
    const sessionObject = this.env.CHAT_SESSIONS.get(sessionObjectId);
    
    // Store message in session history
    const storeMessageReq = new Request('https://dummy-url/store', {
      method: 'POST',
      body: JSON.stringify({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      })
    });
    
    await sessionObject.fetch(storeMessageReq);
    
    // Retrieve conversation history
    const historyReq = new Request('https://dummy-url/history');
    const historyResp = await sessionObject.fetch(historyReq);
    const history = await historyResp.json();
    
    // Initialize components
    const vectorManager = new VectorManager(this.env);
    const faqManager = new FAQManager(this.env, vectorManager);
    const ticketResolver = new TicketResolver(this.env, vectorManager, this.toolRegistry);
    const escalationManager = new EscalationManager(this.companyConfig, this.env);
    
    // Check if this is a support ticket that needs resolution
    const isTicket = this.isTicketRequest(message, history);
    
    // Check if this requires escalation or approval
    const needsEscalation = escalationManager.shouldEscalate(message, { sessionHistory: history });
    
    // Recall previous similar customer interactions
    const previousInteractions = await vectorManager.recallCustomerInteractions(
      this.userId,
      message,
      this.companyConfig.id,
      3
    );
    
    // Process as a ticket if needed
    let ticketAnalysis = null;
    let ticketResolution = null;
    if (isTicket) {
      const ticket = {
        id: crypto.randomUUID(),
        customerId: this.userId,
        description: message,
        priority: this.determinePriority(message)
      };
      
      // Analyze the ticket
      ticketAnalysis = await ticketResolver.analyzeTicket(ticket, this.companyConfig.id);
      
      // Check for similar past resolutions
      const similarResolutions = await ticketResolver.findSimilarResolutions(ticket, this.companyConfig.id);
      
      // If we have a similar resolution with high confidence, use it
      if (similarResolutions.length > 0 && similarResolutions[0].similarity > 0.85) {
        ticketResolution = {
          ticketId: ticket.id,
          status: 'resolved',
          message: `Based on a similar past issue, I can help you with this: ${similarResolutions[0].resolution}`,
          fromPastResolution: true,
          similarTicketId: similarResolutions[0].ticketId
        };
      } 
      // Otherwise, if it requires approval, create an approval request
      else if (ticketAnalysis.requiresApproval) {
        const approvalRequest = await escalationManager.createApprovalRequest(
          'ticket_resolution',
          { ticket, analysis: ticketAnalysis },
          this.userId,
          this.sessionId
        );
        
        ticketResolution = {
          ticketId: ticket.id,
          status: 'pending_approval',
          approvalId: approvalRequest.id,
          message: "This request requires approval from our team. We'll get back to you shortly."
        };
      } 
      // Otherwise, resolve the ticket automatically
      else {
        ticketResolution = await ticketResolver.resolveTicket(
          ticket,
          ticketAnalysis,
          true, // Auto-approved
          this.companyConfig.id
        );
      }
    }
    
    // Try to answer from FAQs if not a ticket or if ticket needs approval
    let faqResponse = null;
    if (!isTicket || (ticketResolution && ticketResolution.status === 'pending_approval')) {
      faqResponse = await faqManager.reasonWithFAQs(message, this.companyConfig.id);
    }
    
    // Retrieve relevant knowledge from vector database
    const relevantKnowledge = await this.retrieveRelevantKnowledge(message);
    
    // Detect potential tool invocations
    const detectedTools = await this.detectToolInvocation(message);
    
    // Execute tools if needed
    let toolResults = {};
    if (detectedTools.length > 0) {
      toolResults = await this.executeTools(detectedTools, message);
    }
    
    // Generate dynamic system prompt with all available context
    const systemPrompt = this.generateEnhancedSystemPrompt(
      relevantKnowledge, 
      toolResults,
      previousInteractions,
      faqResponse,
      ticketResolution
    );
    
    // Prepare messages for AI model
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role, content: msg.content }))
    ];
    
    // Generate response using Cloudflare AI
    const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages,
      stream: false
    });
    
    // Store AI response in session history
    const storeResponseReq = new Request('https://dummy-url/store', {
      method: 'POST',
      body: JSON.stringify({
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        toolsUsed: Object.keys(toolResults)
      })
    });
    
    await sessionObject.fetch(storeResponseReq);
    
    // Store the interaction in memory for future reference
    await vectorManager.storeInteraction(
      this.userId,
      message,
      response.response,
      {
        actions: toolResults,
        resolution: ticketResolution ? ticketResolution.message : null
      },
      this.companyConfig.id
    );
    
    // Prepare the response object with additional context
    const responseObject = {
      message: response.response,
      sessionId: this.sessionId,
      toolsUsed: Object.keys(toolResults)
    };
    
    // Add ticket information if this was processed as a ticket
    if (ticketResolution) {
      responseObject.ticket = {
        id: ticketResolution.ticketId,
        status: ticketResolution.status
      };
      
      // If this requires approval, include the approval ID
      if (ticketResolution.status === 'pending_approval' && ticketResolution.approvalId) {
        responseObject.ticket.approvalId = ticketResolution.approvalId;
      }
    }
    
    return responseObject;
  }

  /**
   * Retrieve relevant knowledge from vector database
   */
  async retrieveRelevantKnowledge(message) {
    try {
      // Create vector embedding for the message
      const embedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: message
      });
      
      // Search for similar vectors in the company's namespace
      const results = await this.env.VECTORIZE_INDEX.query(embedding.data[0], {
        namespace: this.vectorNamespace,
        topK: 5
      });
      
      // Return the relevant knowledge
      return results.map(item => item.metadata.text).join('\n\n');
    } catch (error) {
      console.error('Error retrieving knowledge:', error);
      return '';
    }
  }

  /**
   * Detect if the message requires tool invocation
   */
  async detectToolInvocation(message) {
    try {
      // Use AI to detect intent and required tools
      const detection = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: `You are a tool detection system. Your job is to analyze the user message and determine which tools from the available set should be invoked to help answer their query. Available tools for ${this.companyConfig.agentName} are: ${Object.keys(this.toolRegistry).join(', ')}. 
            
            For each tool, respond with the tool name and the parameters that should be passed to it. If no tools are needed, respond with an empty array.
            
            Respond in JSON format like this:
            {
              "tools": [
                {
                  "name": "toolName",
                  "parameters": {
                    "param1": "value1",
                    "param2": "value2"
                  }
                }
              ]
            }`
          },
          {
            role: 'user',
            content: message
          }
        ],
        stream: false
      });
      
      // Parse the response to get the detected tools
      try {
        const toolsData = JSON.parse(detection.response);
        return toolsData.tools || [];
      } catch (e) {
        console.error('Error parsing tool detection response:', e);
        return [];
      }
    } catch (error) {
      console.error('Error detecting tools:', error);
      return [];
    }
  }

  /**
   * Execute the detected tools
   */
  async executeTools(detectedTools, message) {
    const results = {};
    
    for (const tool of detectedTools) {
      if (this.toolRegistry[tool.name]) {
        try {
          results[tool.name] = await this.toolRegistry[tool.name].execute(tool.parameters);
        } catch (error) {
          console.error(`Error executing tool ${tool.name}:`, error);
          results[tool.name] = { error: `Failed to execute tool: ${error.message}` };
        }
      }
    }
    
    return results;
  }

  /**
   * Determine if a message is a support ticket request
   * @param {string} message - The user message
   * @param {Array} history - Conversation history
   * @returns {boolean} - Whether this is a ticket request
   */
  isTicketRequest(message, history) {
    // Check for explicit ticket keywords
    const ticketKeywords = [
      'ticket', 'issue', 'problem', 'bug', 'error', 'not working',
      'broken', 'fix', 'help me with', 'support request'
    ];
    
    const hasTicketKeyword = ticketKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // If it has a ticket keyword, it's likely a ticket
    if (hasTicketKeyword) {
      return true;
    }
    
    // Check message length - longer messages are more likely to be tickets
    if (message.length > 100) {
      return true;
    }
    
    // Check if this is a follow-up to a previous ticket
    if (history && history.length > 1) {
      const previousMessages = history.slice(-3); // Get last 3 messages
      for (const msg of previousMessages) {
        if (msg.role === 'assistant' && 
            (msg.content.includes('ticket') || msg.content.includes('issue'))) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Determine priority of a ticket based on content
   * @param {string} message - The ticket message
   * @returns {string} - Priority level
   */
  determinePriority(message) {
    const urgentKeywords = ['urgent', 'emergency', 'critical', 'immediately', 'asap'];
    const highKeywords = ['important', 'high priority', 'serious', 'significant'];
    
    const lowercaseMessage = message.toLowerCase();
    
    if (urgentKeywords.some(keyword => lowercaseMessage.includes(keyword))) {
      return 'urgent';
    }
    
    if (highKeywords.some(keyword => lowercaseMessage.includes(keyword))) {
      return 'high';
    }
    
    return 'normal';
  }

  /**
   * Generate enhanced system prompt with all available context
   * @param {Array} relevantKnowledge - Relevant knowledge from vector database
   * @param {Object} toolResults - Results from tool executions
   * @param {Array} previousInteractions - Previous similar customer interactions
   * @param {Object} faqResponse - Response from FAQ reasoning
   * @param {Object} ticketResolution - Ticket resolution information
   * @returns {string} - The enhanced system prompt
   */
  generateEnhancedSystemPrompt(
    relevantKnowledge, 
    toolResults, 
    previousInteractions, 
    faqResponse, 
    ticketResolution
  ) {
    const { agentName, branding, tone, greeting } = this.companyConfig;
    
    let prompt = `You are ${agentName}, a customer support agent for ${branding.companyName}. 
    
    ${branding.description || ''}
    
    Please respond in a ${tone || 'professional'} tone. 
    
    ${greeting || 'How can I help you today?'}
    
    `;
    
    // Add ticket resolution information if available
    if (ticketResolution) {
      prompt += '\n\n=== TICKET RESOLUTION ===\n';
      prompt += `Status: ${ticketResolution.status}\n`;
      
      if (ticketResolution.fromPastResolution) {
        prompt += 'This issue was resolved based on a similar past ticket.\n';
      }
      
      if (ticketResolution.status === 'pending_approval') {
        prompt += 'This ticket requires approval before resolution. Please inform the user.\n';
      }
      
      if (ticketResolution.message) {
        prompt += `Resolution Message: ${ticketResolution.message}\n`;
      }
      
      if (ticketResolution.actions) {
        prompt += `Actions Taken: ${JSON.stringify(ticketResolution.actions)}\n`;
      }
    }
    
    // Add FAQ response if available
    if (faqResponse && faqResponse.hasRelevantInfo) {
      prompt += '\n\n=== FAQ INFORMATION ===\n';
      prompt += `${faqResponse.reasoning}\n`;
      
      if (faqResponse.relevantFAQs && faqResponse.relevantFAQs.length > 0) {
        prompt += 'Relevant FAQs:\n';
        faqResponse.relevantFAQs.forEach((faq, index) => {
          prompt += `[${index + 1}] Q: ${faq.question}\nA: ${faq.answer}\n\n`;
        });
      }
    }
    
    // Add previous similar interactions if available
    if (previousInteractions && previousInteractions.length > 0) {
      prompt += '\n\n=== PREVIOUS SIMILAR INTERACTIONS ===\n';
      prompt += 'This customer has asked similar questions before. Here are the previous interactions:\n';
      
      previousInteractions.forEach((interaction, index) => {
        prompt += `[${index + 1}] Previous Query: ${interaction.query}\n`;
        prompt += `Previous Response: ${interaction.response}\n`;
        if (interaction.actions && Object.keys(interaction.actions).length > 0) {
          prompt += `Actions Taken: ${JSON.stringify(interaction.actions)}\n`;
        }
        prompt += `Similarity Score: ${interaction.similarity.toFixed(2)}\n\n`;
      });
    }
    
    // Add relevant knowledge if available
    if (relevantKnowledge && relevantKnowledge.trim()) {
      prompt += `\n\n=== RELEVANT KNOWLEDGE ===\n${relevantKnowledge}\n\n`;
    }
    
    // Add tool results if available
    if (Object.keys(toolResults).length > 0) {
      prompt += `\n\n=== TOOL RESULTS ===\n`;
      
      for (const [toolName, result] of Object.entries(toolResults)) {
        prompt += `\n- ${toolName}: ${JSON.stringify(result)}\n`;
      }
    }
    
    return prompt;
  }
}