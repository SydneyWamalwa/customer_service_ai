/**
 * CompanyConfigManager - Manages company-specific configurations
 * Handles retrieval, storage, and validation of company settings
 */
export class CompanyConfigManager {
  constructor(env) {
    this.env = env;
  }

  /**
   * Get configuration for a specific company
   */
  async getCompanyConfig(companyId) {
    // In a production environment, this would fetch from KV or D1 database
    // For this implementation, we'll use a mock configuration
    
    // Check if company exists in our mock database
    const companyConfig = MOCK_COMPANY_CONFIGS[companyId];
    
    if (!companyConfig) {
      return null;
    }
    
    return {
      id: companyId,
      ...companyConfig
    };
  }

  /**
   * Update configuration for a specific company
   */
  async updateCompanyConfig(companyId, updates) {
    // In a production environment, this would update KV or D1 database
    // For this implementation, we'll just log the update
    console.log(`Updating config for company ${companyId}:`, updates);
    
    // Validate the updates
    this.validateConfig(updates);
    
    return { success: true };
  }

  /**
   * Validate company configuration
   */
  validateConfig(config) {
    // Required fields
    const requiredFields = ['agentName', 'branding'];
    
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate branding
    if (config.branding) {
      if (!config.branding.companyName) {
        throw new Error('Missing required field: branding.companyName');
      }
    }
    
    // Validate tools
    if (config.tools) {
      if (!Array.isArray(config.tools)) {
        throw new Error('Tools must be an array');
      }
      
      for (const tool of config.tools) {
        if (!tool.name) {
          throw new Error('Each tool must have a name');
        }
      }
    }
    
    return true;
  }
}

// Mock company configurations for development
const MOCK_COMPANY_CONFIGS = {
  'company-1': {
    agentName: 'SupportBot',
    branding: {
      companyName: 'TechCorp',
      description: 'A leading technology company providing innovative solutions.',
      primaryColor: '#4285F4',
      logo: 'https://example.com/techcorp-logo.png'
    },
    tone: 'professional',
    greeting: 'Welcome to TechCorp support! How can I assist you today?',
    vectorNamespace: 'techcorp-knowledge',
    tools: [
      {
        name: 'trackOrder',
        description: 'Track the status of a customer order',
        parameters: {
          orderId: 'Order ID to track'
        },
        webhookUrl: 'https://api.techcorp.example/track-order'
      },
      {
        name: 'lookupAccount',
        description: 'Look up customer account information',
        parameters: {
          email: 'Customer email address'
        },
        webhookUrl: 'https://api.techcorp.example/account-lookup'
      }
    ]
  },
  'company-2': {
    agentName: 'Helpy',
    branding: {
      companyName: 'FriendlyShop',
      description: 'Your friendly neighborhood online store.',
      primaryColor: '#34A853',
      logo: 'https://example.com/friendlyshop-logo.png'
    },
    tone: 'casual',
    greeting: "Hey there! 👋 I'm Helpy from FriendlyShop. What can I help you with today?",
    vectorNamespace: 'friendlyshop-knowledge',
    tools: [
      {
        name: 'checkInventory',
        description: 'Check if a product is in stock',
        parameters: {
          productId: 'Product ID to check'
        },
        webhookUrl: 'https://api.friendlyshop.example/inventory'
      },
      {
        name: 'initiateReturn',
        description: 'Start the return process for a product',
        parameters: {
          orderId: 'Order ID',
          productId: 'Product ID',
          reason: 'Reason for return'
        },
        webhookUrl: 'https://api.friendlyshop.example/returns'
      }
    ]
  }
};