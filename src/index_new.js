/**
 * Multi-Tenant Customer Service AI Platform
 * Main Application Entry Point
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { DatabaseManager } from './database/databaseManager.js';
import { AuthService } from './security/authService.js';
import { authenticate, authorize, enforceDataIsolation, optionalAuthenticate, extractCompanyId } from './middleware/authMiddleware.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createAdminRoutes } from './routes/adminRoutes.js';
import { createAICustomizationRoutes } from './routes/aiCustomizationRoutes.js';
import { createAgentRoutes } from './routes/agentRoutes.js';
import { SupportAgent } from './agent/supportAgent.js';
import { CompanyConfigManager } from './config/companyConfigManager.js';
import { ChatSessionDO } from './durable_objects/chatSession.js';

// Export the Durable Object
export { ChatSessionDO };

// Initialize the Hono app
const app = new Hono();

// Apply CORS middleware to all routes
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Company-ID'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Multi-Tenant Customer Service AI Platform',
    version: '2.0.0'
  });
});

// Initialize services middleware
app.use('*', async (c, next) => {
  const db = new DatabaseManager(c.env.DB);
  const authService = new AuthService(c.env.JWT_SECRET || 'default-secret-change-in-production');
  
  c.set('db', db);
  c.set('authService', authService);
  
  await next();
});

// ==================== PUBLIC ROUTES ====================

// Authentication routes (public)
app.route('/api/auth', (c) => {
  const db = c.get('db');
  const authService = c.get('authService');
  return createAuthRoutes(authService, db);
});

// ==================== PROTECTED ROUTES ====================

// Admin routes (Company Admin only)
app.use('/api/admin/*', async (c, next) => {
  const db = c.get('db');
  const authService = c.get('authService');
  return authenticate(authService, db)(c, async () => {
    return authorize('company_admin')(c, async () => {
      return enforceDataIsolation()(c, next);
    });
  });
});

app.route('/api/admin', (c) => {
  const db = c.get('db');
  const authService = c.get('authService');
  return createAdminRoutes(authService, db);
});

// AI Customization routes (Company Admin only)
app.use('/api/ai/*', async (c, next) => {
  const db = c.get('db');
  const authService = c.get('authService');
  return authenticate(authService, db)(c, async () => {
    return authorize('company_admin')(c, async () => {
      return enforceDataIsolation()(c, next);
    });
  });
});

app.route('/api/ai', (c) => {
  const db = c.get('db');
  return createAICustomizationRoutes(db);
});

// Agent routes (Company Agent only)
app.use('/api/agent/*', async (c, next) => {
  const db = c.get('db');
  const authService = c.get('authService');
  return authenticate(authService, db)(c, async () => {
    return authorize('company_agent')(c, async () => {
      return enforceDataIsolation()(c, next);
    });
  });
});

app.route('/api/agent', (c) => {
  const db = c.get('db');
  return createAgentRoutes(db);
});

// ==================== CHAT ENDPOINT ====================

// Chat endpoint (supports both authenticated and anonymous users)
app.post('/api/chat', async (c) => {
  try {
    const db = c.get('db');
    const authService = c.get('authService');
    
    // Optional authentication
    await optionalAuthenticate(authService, db)(c, async () => {});
    
    const user = c.get('user');
    let companyId = user?.companyId;
    
    // If no authenticated user, get company ID from request
    if (!companyId) {
      companyId = c.req.header('X-Company-ID') || c.req.query('companyId');
    }
    
    if (!companyId) {
      const body = await c.req.json();
      companyId = body.companyId;
    }
    
    if (!companyId) {
      return c.json({ 
        error: 'Company ID is required',
        message: 'Please provide a company ID to start chatting'
      }, 400);
    }
    
    console.log('Chat endpoint hit - Company ID:', companyId);
    
    const configManager = new CompanyConfigManager(c.env);
    const companyConfig = await configManager.getCompanyConfig(companyId);
    
    if (!companyConfig) {
      console.error('Company not found:', companyId);
      return c.json({ 
        error: 'Company not found',
        response: "I apologize, but I couldn't load the configuration for your company. Please try again or contact support."
      }, 200);
    }
    
    const body = await c.req.json();
    const { message, userId, sessionId } = body;
    
    console.log('Received message:', message);
    
    if (!message) {
      return c.json({ 
        error: 'Message is required',
        response: "Please enter a message."
      }, 400);
    }
    
    const agent = new SupportAgent({
      env: c.env,
      companyConfig,
      userId: userId || user?.userId || 'anonymous',
      sessionId: sessionId || crypto.randomUUID()
    });
    
    const response = await agent.processMessage(message);
    
    console.log('Response generated:', response);
    
    return c.json(response);
    
  } catch (error) {
    console.error('Chat endpoint error:', error);
    console.error('Error stack:', error.stack);
    
    return c.json({ 
      error: 'Internal server error',
      message: error.message,
      response: "I apologize, but I encountered an error processing your message. Please try again."
    }, 200);
  }
});

// ==================== FEEDBACK ENDPOINT ====================

app.post('/api/feedback', async (c) => {
  try {
    const db = c.get('db');
    const body = await c.req.json();
    const { companyId, conversationId, customerId, rating, comment } = body;
    
    if (!companyId || !conversationId || !rating) {
      return c.json({ 
        error: 'Missing required fields',
        message: 'companyId, conversationId, and rating are required'
      }, 400);
    }
    
    const feedbackId = crypto.randomUUID();
    await db.createFeedback(feedbackId, companyId, conversationId, customerId, rating, comment);
    
    console.log('Feedback received:', { companyId, conversationId, rating, comment });
    
    return c.json({ 
      success: true,
      message: 'Thank you for your feedback!'
    });
  } catch (error) {
    console.error('Feedback error:', error);
    return c.json({ 
      error: 'Failed to submit feedback',
      message: error.message 
    }, 500);
  }
});

// ==================== WIDGET CONFIGURATION ENDPOINT ====================

app.get('/api/widget/config/:companyId', async (c) => {
  try {
    const db = c.get('db');
    const companyId = c.req.param('companyId');
    
    const config = await db.getAgentConfiguration(companyId);
    
    if (!config) {
      return c.json({ 
        error: 'Configuration not found' 
      }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        agentName: config.agent_name,
        brandingName: config.branding_name,
        brandingLogo: config.branding_logo,
        brandingPrimaryColor: config.branding_primary_color,
        greetingMessage: config.greeting_message
      }
    });
  } catch (error) {
    console.error('Get widget config error:', error);
    return c.json({ 
      error: 'Failed to get configuration',
      message: error.message 
    }, 500);
  }
});

// ==================== STATIC FILES ====================

// Serve static files (HTML, CSS, JS)
app.get('/admin/*', serveStatic({ root: './public' }));
app.get('/widget.js', serveStatic({ path: './public/widget.js' }));
app.get('/*', serveStatic({ root: './public' }));

// Fallback to index.html for SPA routing
app.get('/', serveStatic({ path: './public/index.html' }));

// ==================== ERROR HANDLING ====================

app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json({
    error: 'Internal server error',
    message: err.message
  }, 500);
});

// ==================== EXPORT ====================

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    // Handle scheduled tasks
    console.log('Scheduled task triggered:', event);
    
    // Clean up expired sessions
    try {
      const db = new DatabaseManager(env.DB);
      await db.deleteExpiredSessions();
      console.log('Expired sessions cleaned up');
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  }
};
