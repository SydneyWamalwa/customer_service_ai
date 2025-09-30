import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SupportAgent } from './agent/supportAgent';
import { CompanyConfigManager } from './config/companyConfigManager';
import { serveStatic } from 'hono/cloudflare-workers';
import { ChatSessionDO } from './durable_objects/chatSession';

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
    service: 'Customer Service AI'
  });
});

// Simple middleware to extract company ID
app.use('/api/*', async (c, next) => {
  let companyId = c.req.header('X-Company-ID') || c.req.query('companyId') || 'company-1';
  c.set('companyId', companyId);
  await next();
});

// Chat endpoint - PRIMARY FIX
app.post('/api/chat', async (c) => {
  try {
    console.log('Chat endpoint hit');
    
    const companyId = c.get('companyId') || 'company-1';
    console.log('Company ID:', companyId);
    
    const configManager = new CompanyConfigManager(c.env);
    const companyConfig = await configManager.getCompanyConfig(companyId);
    
    if (!companyConfig) {
      console.error('Company not found:', companyId);
      return c.json({ 
        error: 'Company not found',
        response: "I apologize, but I couldn't load the configuration for your company. Please try again or contact support."
      }, 200); // Return 200 to prevent errors on frontend
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
      userId: userId || 'anonymous',
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
    }, 200); // Return 200 to show error message instead of generic error
  }
});

// Feedback endpoint
app.post('/api/feedback', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, rating, comment } = body;
    
    console.log('Feedback received:', { sessionId, rating, comment });
    
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

// Admin config endpoint
app.post('/api/admin/config', async (c) => {
  try {
    const companyId = c.get('companyId');
    const body = await c.req.json();
    
    const configManager = new CompanyConfigManager(c.env);
    await configManager.updateCompanyConfig(companyId, body);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Config update error:', error);
    return c.json({ 
      error: 'Failed to update config',
      message: error.message 
    }, 500);
  }
});

// Serve static files (HTML, CSS, JS)
app.get('/*', serveStatic({ root: './' }));

// Fallback to index.html for SPA routing
app.get('/', serveStatic({ path: './index.html' }));

// Export the worker
export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    // Handle scheduled tasks if needed
    console.log('Scheduled task triggered:', event);
  }
};