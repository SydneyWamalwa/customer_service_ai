import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SupportAgent } from './agent/supportAgent';
import { CompanyConfigManager } from './config/companyConfigManager';
import { authMiddleware } from './middleware/auth';
import { getCompanyIdMiddleware } from './middleware/companyId';
import { serveStatic } from 'hono/cloudflare-workers';
import { ChatSessionDO } from './durable_objects/chatSession.js';

// Initialize the Hono app
const app = new Hono();
export { ChatSessionDO };

// Apply CORS middleware
app.use('*', cors({
  origin: '*', // In production, restrict this to your domains
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

// Serve static files - this will serve files from your public directory
app.use('/*', serveStatic());

// Serve the main UI - this should now work correctly
app.get('/', (c) => {
  // Since static files are served from root with the [site] config,
  // the index.html should be accessible directly
  return c.redirect('/index.html', 302);
});

// Add a health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Customer Service AI'
  });
});

// Company-specific routes with middleware
const api = new Hono();
api.use('*', getCompanyIdMiddleware);
api.use('/secure/*', authMiddleware);

// Chat API endpoints
api.post('/chat', async (c) => {
  const companyId = c.get('companyId');
  const configManager = new CompanyConfigManager(c.env);
  const companyConfig = await configManager.getCompanyConfig(companyId);
  
  if (!companyConfig) {
    return c.json({ error: 'Company not found' }, 404);
  }
  
  const body = await c.req.json();
  const { message, userId, sessionId } = body;
  
  if (!message) {
    return c.json({ error: 'Message is required' }, 400);
  }
  
  const agent = new SupportAgent({
    env: c.env,
    companyConfig,
    userId,
    sessionId
  });
  
  const response = await agent.processMessage(message);
  return c.json(response);
});

// WebSocket endpoint for real-time chat
api.get('/chat/ws', async (c) => {
  const upgradeHeader = c.req.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected Upgrade: websocket' }, 426);
  }

  const companyId = c.get('companyId');
  const configManager = new CompanyConfigManager(c.env);
  const companyConfig = await configManager.getCompanyConfig(companyId);
  
  if (!companyConfig) {
    return c.json({ error: 'Company not found' }, 404);
  }
  
  const userId = c.req.query('userId');
  const sessionId = c.req.query('sessionId');
  
  const agent = new SupportAgent({
    env: c.env,
    companyConfig,
    userId,
    sessionId
  });
  
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);
  
  server.accept();
  
  // Handle WebSocket messages
  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        const response = await agent.processMessage(data.message);
        server.send(JSON.stringify({
          type: 'response',
          data: response
        }));
      }
    } catch (error) {
      server.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });
  
  // Handle WebSocket close
  server.addEventListener('close', () => {
    // Clean up resources if needed
  });
  
  return new Response(null, {
    status: 101,
    webSocket: client
  });
});

// Secure endpoints that require authentication
api.post('/secure/feedback', async (c) => {
  const body = await c.req.json();
  const { messageId, rating, comment } = body;
  
  // Store feedback in database
  // This would be implemented with Cloudflare D1 or another database
  
  return c.json({ success: true });
});

// Admin panel API endpoints
api.post('/secure/admin/config', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  
  const configManager = new CompanyConfigManager(c.env);
  await configManager.updateCompanyConfig(companyId, body);
  
  return c.json({ success: true });
});

// Mount the API router
app.route('/api', api);

// Export the Hono app
export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    // Handle scheduled tasks if needed
  }
};