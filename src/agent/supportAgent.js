/**
 * SupportAgent - Core agent class for multi-tenant customer support
 * Handles message processing, tool invocation, and context management
 * FIXED VERSION with proper error handling and simplified flow
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
          try {
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
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              return await response.json();
            }
            
            // Default response if no handler or webhook is defined
            return { error: 'Tool execution method not defined' };
          } catch (error) {
            console.error(`Error in tool ${tool.name}:`, error);
            return { error: `Tool execution failed: ${error.message}` };
          }
        }
      };
    });
    
    return registry;
  }

  /**
   * Process an incoming message and generate a response
   */
  async processMessage(message) {
    try {
      console.log(`Processing message for user ${this.userId}: ${message}`);
      
      // Initialize session handling with error recovery
      let history = [];
      try {
        const sessionId = this.sessionId;
        const sessionObjectId = this.env.CHAT_SESSIONS?.idFromName(sessionId);
        const sessionObject = this.env.CHAT_SESSIONS?.get(sessionObjectId);
        
        if (sessionObject) {
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
          history = await historyResp.json();
        }
      } catch (sessionError) {
        console.warn('Session handling failed, continuing without history:', sessionError);
        // Add current message to history manually
        history = [{ role: 'user', content: message, timestamp: new Date().toISOString() }];
      }

      // Initialize components with error handling
      let vectorManager, faqManager, ticketResolver, escalationManager;
      try {
        vectorManager = new VectorManager(this.env);
        faqManager = new FAQManager(this.env, vectorManager);
        ticketResolver = new TicketResolver(this.env, vectorManager, this.toolRegistry);
        escalationManager = new EscalationManager(this.companyConfig, this.env);
      } catch (initError) {
        console.warn('Some components failed to initialize:', initError);
      }

      // Simplified processing flow
      let relevantKnowledge = '';
      let toolResults = {};
      let faqResponse = null;
      let ticketResolution = null;
      let previousInteractions = [];

      // Try to get relevant knowledge (non-blocking)
      try {
        relevantKnowledge = await this.retrieveRelevantKnowledge(message);
      } catch (error) {
        console.warn('Failed to retrieve knowledge:', error);
      }

      // Check if this is a ticket request
      const isTicket = this.isTicketRequest(message, history);
      
      // Process as ticket if needed
      if (isTicket && ticketResolver) {
        try {
          const ticket = {
            id: crypto.randomUUID(),
            customerId: this.userId,
            description: message,
            priority: this.determinePriority(message)
          };
          
          const ticketAnalysis = await ticketResolver.analyzeTicket(ticket, this.companyConfig.id);
          
          if (ticketAnalysis && !ticketAnalysis.requiresApproval) {
            ticketResolution = await ticketResolver.resolveTicket(
              ticket,
              ticketAnalysis,
              true,
              this.companyConfig.id
            );
          }
        } catch (ticketError) {
          console.warn('Ticket processing failed:', ticketError);
        }
      }

      // Try FAQ response if not resolved by ticket
      if (!ticketResolution && faqManager) {
        try {
          faqResponse = await faqManager.reasonWithFAQs(message, this.companyConfig.id);
        } catch (faqError) {
          console.warn('FAQ processing failed:', faqError);
        }
      }

      // Try tool detection and execution
      try {
        const detectedTools = await this.detectToolInvocation(message);
        if (detectedTools.length > 0) {
          toolResults = await this.executeTools(detectedTools, message);
        }
      } catch (toolError) {
        console.warn('Tool processing failed:', toolError);
      }

      // Generate system prompt with available context
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
        ...history.slice(-10).map(msg => ({ role: msg.role, content: msg.content })) // Limit history
      ];

      console.log('Sending to AI model:', { 
        messageCount: messages.length,
        systemPromptLength: systemPrompt.length 
      });

      // Generate response using Cloudflare AI with error handling
      let aiResponse;
      try {
        const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages,
          stream: false,
          max_tokens: 1024 // Add token limit to prevent issues
        });
        
        aiResponse = response.response || response.text || 'I apologize, but I encountered an issue generating a response.';
      } catch (aiError) {
        console.error('AI model error:', aiError);
        aiResponse = this.generateFallbackResponse(message, faqResponse, ticketResolution);
      }

      // Try to store response in session (non-blocking)
      try {
        if (this.env.CHAT_SESSIONS) {
          const sessionObjectId = this.env.CHAT_SESSIONS.idFromName(this.sessionId);
          const sessionObject = this.env.CHAT_SESSIONS.get(sessionObjectId);
          
          const storeResponseReq = new Request('https://dummy-url/store', {
            method: 'POST',
            body: JSON.stringify({
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date().toISOString(),
              toolsUsed: Object.keys(toolResults)
            })
          });
          
          await sessionObject.fetch(storeResponseReq);
        }
      } catch (storeError) {
        console.warn('Failed to store response in session:', storeError);
      }

      // Try to store interaction for future reference (non-blocking)
      try {
        if (vectorManager) {
          await vectorManager.storeInteraction(
            this.userId,
            message,
            aiResponse,
            {
              actions: toolResults,
              resolution: ticketResolution ? ticketResolution.message : null
            },
            this.companyConfig.id
          );
        }
      } catch (storeError) {
        console.warn('Failed to store interaction:', storeError);
      }

      // Prepare response object
      const responseObject = {
        message: aiResponse,
        sessionId: this.sessionId,
        toolsUsed: Object.keys(toolResults)
      };

      if (ticketResolution) {
        responseObject.ticket = {
          id: ticketResolution.ticketId,
          status: ticketResolution.status
        };
        
        if (ticketResolution.status === 'pending_approval' && ticketResolution.approvalId) {
          responseObject.ticket.approvalId = ticketResolution.approvalId;
        }
      }

      console.log('Response generated successfully');
      return responseObject;

    } catch (error) {
      console.error('Critical error in processMessage:', error);
      
      // Return a basic fallback response
      return {
        message: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment, or contact our support team directly if the issue persists.",
        sessionId: this.sessionId,
        toolsUsed: [],
        error: error.message
      };
    }
  }

  /**
   * Generate a fallback response when AI model fails
   */
  generateFallbackResponse(message, faqResponse, ticketResolution) {
    // If we have a ticket resolution, use that
    if (ticketResolution && ticketResolution.message) {
      return ticketResolution.message;
    }

    // If we have an FAQ response, use that
    if (faqResponse && faqResponse.hasRelevantInfo && faqResponse.relevantFAQs && faqResponse.relevantFAQs.length > 0) {
      const faq = faqResponse.relevantFAQs[0];
      return `Based on our FAQ: ${faq.answer}`;
    }

    // Basic greeting responses
    const greetingKeywords = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    if (greetingKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      return `Hello! I'm ${this.companyConfig.agentName || 'your support assistant'}. How can I help you today?`;
    }

    // Capability questions
    const capabilityKeywords = ['what can you do', 'what do you do', 'help me', 'capabilities'];
    if (capabilityKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      return `I'm here to help you with ${this.companyConfig.branding?.companyName || 'our'} products and services. I can answer questions, help resolve issues, and provide information about our offerings. What specific assistance do you need?`;
    }

    // Default fallback
    return "Thank you for your message. I'm here to help! Could you please provide more details about what you need assistance with?";
  }

  /**
   * Retrieve relevant knowledge from vector database with error handling
   */
  async retrieveRelevantKnowledge(message) {
    try {
      if (!this.env.AI || !this.env.VECTORIZE_INDEX) {
        console.warn('AI or VECTORIZE_INDEX not available');
        return '';
      }

      // Create vector embedding for the message
      const embedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: message
      });
      
      if (!embedding || !embedding.data || !embedding.data[0]) {
        console.warn('Failed to create embedding');
        return '';
      }

      // Search for similar vectors in the company's namespace
      const results = await this.env.VECTORIZE_INDEX.query(embedding.data[0], {
        namespace: this.vectorNamespace,
        topK: 3 // Reduced from 5 to limit context size
      });
      
      // Return the relevant knowledge
      return results.map(item => item.metadata?.text || '').filter(Boolean).join('\n\n');
    } catch (error) {
      console.error('Error retrieving knowledge:', error);
      return '';
    }
  }

  /**
   * Detect if the message requires tool invocation with simplified logic
   */
  async detectToolInvocation(message) {
    try {
      // If no tools are registered, return empty array
      if (Object.keys(this.toolRegistry).length === 0) {
        return [];
      }

      // Simple keyword-based detection for common tools
      const toolKeywords = {
        'account_lookup': ['account', 'user', 'customer', 'profile'],
        'order_status': ['order', 'purchase', 'shipping', 'delivery'],
        'billing': ['bill', 'payment', 'invoice', 'charge'],
        'technical_support': ['bug', 'error', 'not working', 'broken']
      };

      const detectedTools = [];
      const messageLower = message.toLowerCase();

      for (const [toolName, keywords] of Object.entries(toolKeywords)) {
        if (this.toolRegistry[toolName] && keywords.some(keyword => messageLower.includes(keyword))) {
          detectedTools.push({
            name: toolName,
            parameters: { query: message }
          });
        }
      }

      return detectedTools;
    } catch (error) {
      console.error('Error detecting tools:', error);
      return [];
    }
  }

  /**
   * Execute the detected tools with improved error handling
   */
  async executeTools(detectedTools, message) {
    const results = {};
    
    for (const tool of detectedTools) {
      if (this.toolRegistry[tool.name]) {
        try {
          console.log(`Executing tool: ${tool.name}`);
          results[tool.name] = await this.toolRegistry[tool.name].execute(tool.parameters);
        } catch (error) {
          console.error(`Error executing tool ${tool.name}:`, error);
          results[tool.name] = { 
            error: `Failed to execute tool: ${error.message}`,
            success: false
          };
        }
      }
    }
    
    return results;
  }

  /**
   * Determine if a message is a support ticket request
   */
  isTicketRequest(message, history) {
    const ticketKeywords = [
      'issue', 'problem', 'bug', 'error', 'not working',
      'broken', 'fix', 'help me with', 'support request', 'complaint'
    ];
    
    const messageLower = message.toLowerCase();
    const hasTicketKeyword = ticketKeywords.some(keyword => 
      messageLower.includes(keyword)
    );
    
    // If it has ticket keywords or is a long message, treat as ticket
    return hasTicketKeyword || message.length > 100;
  }
  
  /**
   * Determine priority of a ticket based on content
   */
  determinePriority(message) {
    const urgentKeywords = ['urgent', 'emergency', 'critical', 'immediately', 'asap', 'down', 'outage'];
    const highKeywords = ['important', 'high priority', 'serious', 'significant', 'major'];
    
    const messageLower = message.toLowerCase();
    
    if (urgentKeywords.some(keyword => messageLower.includes(keyword))) {
      return 'urgent';
    }
    
    if (highKeywords.some(keyword => messageLower.includes(keyword))) {
      return 'high';
    }
    
    return 'normal';
  }

  /**
   * Generate enhanced system prompt with better error handling
   */
  generateEnhancedSystemPrompt(
    relevantKnowledge, 
    toolResults, 
    previousInteractions, 
    faqResponse, 
    ticketResolution
  ) {
    const { agentName, branding, tone, greeting } = this.companyConfig;
    
    let prompt = `You are ${agentName || 'a helpful customer support assistant'}, a customer support agent for ${branding?.companyName || 'this company'}. 

${branding?.description || ''}

Please respond in a ${tone || 'professional and friendly'} tone.

${greeting || 'How can I help you today?'}

Keep responses concise and helpful. If you don't have specific information, acknowledge this and offer to help in other ways.

`;
    
    // Add context sections only if they contain useful information
    if (ticketResolution) {
      prompt += `\n=== TICKET STATUS ===\n${ticketResolution.message}\n\n`;
    }
    
    if (faqResponse?.hasRelevantInfo && faqResponse.relevantFAQs?.length > 0) {
      prompt += `\n=== RELEVANT FAQ ===\n`;
      const faq = faqResponse.relevantFAQs[0];
      prompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
    }
    
    if (relevantKnowledge && relevantKnowledge.trim().length > 0) {
      prompt += `\n=== KNOWLEDGE BASE ===\n${relevantKnowledge.substring(0, 500)}...\n\n`;
    }
    
    if (Object.keys(toolResults).length > 0) {
      prompt += `\n=== SYSTEM INFORMATION ===\n`;
      for (const [toolName, result] of Object.entries(toolResults)) {
        if (result && !result.error) {
          prompt += `${toolName}: ${JSON.stringify(result).substring(0, 200)}\n`;
        }
      }
      prompt += '\n';
    }
    
    return prompt;
  }
}