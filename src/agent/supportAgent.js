/**
 * SupportAgent - Core agent class for multi-tenant customer support
 * Handles message processing, tool invocation, and context management
 */
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
    
    // Retrieve relevant knowledge from vector database
    const relevantKnowledge = await this.retrieveRelevantKnowledge(message);
    
    // Detect potential tool invocations
    const detectedTools = await this.detectToolInvocation(message);
    
    // Execute tools if needed
    let toolResults = {};
    if (detectedTools.length > 0) {
      toolResults = await this.executeTools(detectedTools, message);
    }
    
    // Generate dynamic system prompt
    const systemPrompt = this.generateSystemPrompt(relevantKnowledge, toolResults);
    
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
    
    // Return the final response
    return {
      message: response.response,
      sessionId: this.sessionId,
      toolsUsed: Object.keys(toolResults)
    };
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
   * Generate a dynamic system prompt based on company config and context
   */
  generateSystemPrompt(relevantKnowledge, toolResults) {
    const { agentName, branding, tone, greeting } = this.companyConfig;
    
    let prompt = `You are ${agentName}, a customer support agent for ${branding.companyName}. 
    
    ${branding.description || ''}
    
    Please respond in a ${tone || 'professional'} tone. 
    
    ${greeting || 'How can I help you today?'}
    
    `;
    
    // Add relevant knowledge if available
    if (relevantKnowledge && relevantKnowledge.trim()) {
      prompt += `\n\nHere is some relevant information that might help with the response:\n${relevantKnowledge}\n\n`;
    }
    
    // Add tool results if available
    if (Object.keys(toolResults).length > 0) {
      prompt += `\n\nI've gathered the following information from our systems:\n`;
      
      for (const [toolName, result] of Object.entries(toolResults)) {
        prompt += `\n- ${toolName}: ${JSON.stringify(result)}\n`;
      }
      
      prompt += `\nPlease use this information in your response as appropriate.\n`;
    }
    
    return prompt;
  }
}