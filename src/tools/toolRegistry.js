/**
 * ToolRegistry - Manages custom tool registration and execution
 * Handles dynamic tool loading and invocation for each company
 */
export class ToolRegistry {
  constructor(companyConfig) {
    this.companyConfig = companyConfig;
    this.tools = this.registerTools(companyConfig.tools || []);
  }

  /**
   * Register company-specific tools
   */
  registerTools(toolConfigs) {
    const registry = {};
    
    toolConfigs.forEach(tool => {
      registry[tool.name] = {
        ...tool,
        execute: async (params, env, context) => {
          // If the tool has a custom handler function defined
          if (tool.handlerFunction && typeof tool.handlerFunction === 'function') {
            return await tool.handlerFunction(params, this.companyConfig, env, context);
          }
          
          // If the tool has a webhook URL defined
          if (tool.webhookUrl) {
            const response = await fetch(tool.webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Company-ID': this.companyConfig.id,
                'X-User-ID': context.userId,
                'Authorization': `Bearer ${tool.apiKey || this.companyConfig.apiKey || ''}`
              },
              body: JSON.stringify({
                tool: tool.name,
                params,
                userId: context.userId,
                sessionId: context.sessionId
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
   * Execute a specific tool
   */
  async executeTool(toolName, params, env, context) {
    if (!this.tools[toolName]) {
      return { error: `Tool '${toolName}' not found` };
    }
    
    try {
      return await this.tools[toolName].execute(params, env, context);
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return { error: `Failed to execute tool: ${error.message}` };
    }
  }

  /**
   * Get tool schema for AI prompt
   */
  getToolSchemas() {
    const schemas = [];
    
    for (const [name, tool] of Object.entries(this.tools)) {
      schemas.push({
        name,
        description: tool.description || `Execute the ${name} tool`,
        parameters: tool.parameters || {}
      });
    }
    
    return schemas;
  }

  /**
   * Detect which tools should be invoked based on user message
   */
  async detectToolsToInvoke(message, env) {
    try {
      // Use AI to detect intent and required tools
      const detection = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: `You are a tool detection system. Your job is to analyze the user message and determine which tools from the available set should be invoked to help answer their query. Available tools for ${this.companyConfig.agentName} are: ${Object.keys(this.tools).join(', ')}. 
            
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
}