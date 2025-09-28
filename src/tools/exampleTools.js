/**
 * Example tool definitions for the multi-tenant customer support agent
 * These tools can be registered per company and invoked by the agent
 */

// Example tool for tracking orders
const trackOrderTool = {
  name: 'trackOrder',
  description: 'Track the status of a customer order',
  parameters: {
    type: 'object',
    properties: {
      orderId: {
        type: 'string',
        description: 'The order ID to track'
      }
    },
    required: ['orderId']
  },
  handler: async ({ orderId }, { companyId, userId }) => {
    console.log(`Tracking order ${orderId} for company ${companyId} and user ${userId}`);
    
    // In a real implementation, this would call a company-specific API
    // For demo purposes, we'll return mock data
    
    const mockOrderStatuses = {
      'company-1': {
        'ORD-123': { status: 'shipped', estimatedDelivery: '2023-06-15', carrier: 'FedEx', trackingNumber: '1234567890' },
        'ORD-456': { status: 'processing', estimatedShipDate: '2023-06-10' },
        'ORD-789': { status: 'delivered', deliveryDate: '2023-06-01' }
      },
      'company-2': {
        'ORD-123': { status: 'preparing', estimatedShipDate: '2023-06-12' },
        'ORD-456': { status: 'out_for_delivery', estimatedDelivery: 'today' },
        'ORD-789': { status: 'cancelled', reason: 'customer request' }
      }
    };
    
    // Get company-specific order data
    const companyOrders = mockOrderStatuses[companyId] || {};
    const orderData = companyOrders[orderId];
    
    if (!orderData) {
      return {
        success: false,
        error: `Order ${orderId} not found for your account.`
      };
    }
    
    return {
      success: true,
      data: orderData
    };
  }
};

// Example tool for looking up account information
const lookupAccountTool = {
  name: 'lookupAccount',
  description: 'Look up customer account information',
  parameters: {
    type: 'object',
    properties: {
      accountId: {
        type: 'string',
        description: 'The account ID to look up'
      }
    },
    required: ['accountId']
  },
  handler: async ({ accountId }, { companyId, userId }) => {
    console.log(`Looking up account ${accountId} for company ${companyId} and user ${userId}`);
    
    // In a real implementation, this would call a company-specific API
    // For demo purposes, we'll return mock data
    
    const mockAccountData = {
      'company-1': {
        'ACC-123': { 
          name: 'John Doe', 
          email: 'john@example.com', 
          plan: 'Premium', 
          billingCycle: 'Monthly',
          nextBillingDate: '2023-07-01'
        },
        'ACC-456': { 
          name: 'Jane Smith', 
          email: 'jane@example.com', 
          plan: 'Basic', 
          billingCycle: 'Annual',
          nextBillingDate: '2023-12-15'
        }
      },
      'company-2': {
        'ACC-123': { 
          name: 'Alice Johnson', 
          email: 'alice@example.com', 
          membershipLevel: 'Gold', 
          points: 1250,
          memberSince: '2020-03-15'
        },
        'ACC-456': { 
          name: 'Bob Williams', 
          email: 'bob@example.com', 
          membershipLevel: 'Silver', 
          points: 750,
          memberSince: '2021-08-22'
        }
      }
    };
    
    // Get company-specific account data
    const companyAccounts = mockAccountData[companyId] || {};
    const accountData = companyAccounts[accountId];
    
    if (!accountData) {
      return {
        success: false,
        error: `Account ${accountId} not found.`
      };
    }
    
    return {
      success: true,
      data: accountData
    };
  }
};

// Example tool for scheduling appointments
const scheduleAppointmentTool = {
  name: 'scheduleAppointment',
  description: 'Schedule a customer appointment or service call',
  parameters: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'The type of service needed'
      },
      date: {
        type: 'string',
        description: 'The preferred date (YYYY-MM-DD)'
      },
      timeSlot: {
        type: 'string',
        description: 'The preferred time slot (morning, afternoon, evening)'
      }
    },
    required: ['service', 'date', 'timeSlot']
  },
  handler: async ({ service, date, timeSlot }, { companyId, userId }) => {
    console.log(`Scheduling ${service} appointment for company ${companyId} and user ${userId}`);
    
    // In a real implementation, this would call a company-specific API
    // For demo purposes, we'll return mock data
    
    // Check if the requested date is in the future
    const requestedDate = new Date(date);
    const today = new Date();
    
    if (requestedDate < today) {
      return {
        success: false,
        error: 'Appointment date must be in the future.'
      };
    }
    
    // Mock available time slots
    const availableSlots = {
      'company-1': {
        'morning': ['09:00', '10:00', '11:00'],
        'afternoon': ['13:00', '14:00', '15:00'],
        'evening': ['17:00', '18:00']
      },
      'company-2': {
        'morning': ['08:30', '09:30', '10:30'],
        'afternoon': ['12:30', '14:30', '16:30'],
        'evening': ['18:30', '19:30']
      }
    };
    
    const companySlots = availableSlots[companyId] || {};
    const slots = companySlots[timeSlot] || [];
    
    if (slots.length === 0) {
      return {
        success: false,
        error: `No ${timeSlot} slots available for ${date}.`
      };
    }
    
    // Randomly select an available slot
    const selectedSlot = slots[Math.floor(Math.random() * slots.length)];
    
    // Generate a confirmation number
    const confirmationNumber = 'APPT-' + Math.floor(100000 + Math.random() * 900000);
    
    return {
      success: true,
      data: {
        confirmationNumber,
        service,
        date,
        time: selectedSlot,
        notes: `Please arrive 15 minutes before your scheduled time. Bring your ID.`
      }
    };
  }
};

// Example tool for reporting issues
const reportIssueTool = {
  name: 'reportIssue',
  description: 'Report a customer issue or problem',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'The category of the issue (product, service, billing, other)'
      },
      description: {
        type: 'string',
        description: 'A description of the issue'
      },
      severity: {
        type: 'string',
        description: 'The severity of the issue (low, medium, high)'
      }
    },
    required: ['category', 'description']
  },
  handler: async ({ category, description, severity = 'medium' }, { companyId, userId }) => {
    console.log(`Reporting ${severity} ${category} issue for company ${companyId} and user ${userId}`);
    
    // In a real implementation, this would call a company-specific API
    // For demo purposes, we'll return mock data
    
    // Generate a ticket number
    const ticketNumber = 'TICKET-' + Math.floor(100000 + Math.random() * 900000);
    
    // Determine estimated response time based on severity
    let estimatedResponse;
    switch (severity) {
      case 'high':
        estimatedResponse = '4 hours';
        break;
      case 'medium':
        estimatedResponse = '24 hours';
        break;
      case 'low':
        estimatedResponse = '48 hours';
        break;
      default:
        estimatedResponse = '24 hours';
    }
    
    return {
      success: true,
      data: {
        ticketNumber,
        category,
        description,
        severity,
        status: 'open',
        createdAt: new Date().toISOString(),
        estimatedResponse
      }
    };
  }
};

// Example tool for checking product availability
const checkProductAvailabilityTool = {
  name: 'checkProductAvailability',
  description: 'Check if a product is in stock and available for purchase',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'The product ID to check'
      },
      location: {
        type: 'string',
        description: 'The location or store to check (optional)'
      }
    },
    required: ['productId']
  },
  handler: async ({ productId, location }, { companyId }) => {
    console.log(`Checking availability for product ${productId} at ${location || 'all locations'} for company ${companyId}`);
    
    // Mock product data
    const mockProducts = {
      'company-1': {
        'PROD-123': { name: 'Laptop Pro', inStock: true, quantity: 15, locations: ['Store A', 'Store C', 'Online'] },
        'PROD-456': { name: 'Wireless Headphones', inStock: true, quantity: 8, locations: ['Store B', 'Online'] },
        'PROD-789': { name: 'Smart Watch', inStock: false, expectedRestock: '2023-06-30' }
      },
      'company-2': {
        'PROD-123': { name: 'Organic Coffee Beans', inStock: true, quantity: 25, locations: ['Store A', 'Store B', 'Online'] },
        'PROD-456': { name: 'Ceramic Mug Set', inStock: true, quantity: 12, locations: ['Store A', 'Online'] },
        'PROD-789': { name: 'French Press', inStock: false, expectedRestock: '2023-06-20' }
      }
    };
    
    // Get company-specific product data
    const companyProducts = mockProducts[companyId] || {};
    const productData = companyProducts[productId];
    
    if (!productData) {
      return {
        success: false,
        error: `Product ${productId} not found.`
      };
    }
    
    // If location is specified, check if product is available at that location
    if (location && productData.inStock) {
      const availableAtLocation = productData.locations && productData.locations.includes(location);
      
      if (!availableAtLocation) {
        return {
          success: true,
          data: {
            ...productData,
            inStock: false,
            message: `${productData.name} is not available at ${location}, but is available at: ${productData.locations.join(', ')}`
          }
        };
      }
    }
    
    return {
      success: true,
      data: productData
    };
  }
};

// Export all tools
module.exports = {
  trackOrderTool,
  lookupAccountTool,
  scheduleAppointmentTool,
  reportIssueTool,
  checkProductAvailabilityTool
};