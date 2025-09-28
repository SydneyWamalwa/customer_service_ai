/**
 * ChatSessionDO - Durable Object for managing chat session state
 * Stores conversation history, user info, and session metadata
 */
export class ChatSessionDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.split('/').pop();

    // Handle different operations based on the path
    switch (path) {
      case 'store':
        return await this.handleStoreMessage(request);
      case 'history':
        return await this.handleGetHistory(request);
      case 'metadata':
        return await this.handleGetMetadata(request);
      case 'update-metadata':
        return await this.handleUpdateMetadata(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  // Store a new message in the conversation history
  async handleStoreMessage(request) {
    const message = await request.json();
    
    // Get existing history or initialize new array
    let history = await this.storage.get('history') || [];
    
    // Add the new message with an ID
    const messageWithId = {
      ...message,
      id: crypto.randomUUID()
    };
    
    // Add to history and store
    history.push(messageWithId);
    
    // Limit history size to prevent excessive storage
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    await this.storage.put('history', history);
    
    // Update last activity timestamp
    await this.storage.put('lastActivity', new Date().toISOString());
    
    return new Response(JSON.stringify({ success: true, messageId: messageWithId.id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get conversation history
  async handleGetHistory(request) {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    let history = await this.storage.get('history') || [];
    
    // Return the most recent messages up to the limit
    const limitedHistory = history.slice(-limit);
    
    return new Response(JSON.stringify(limitedHistory), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get session metadata
  async handleGetMetadata(request) {
    const metadata = await this.storage.get('metadata') || {
      created: new Date().toISOString(),
      userId: 'anonymous',
      companyId: '',
      escalated: false,
      tags: []
    };
    
    const lastActivity = await this.storage.get('lastActivity');
    
    return new Response(JSON.stringify({
      ...metadata,
      lastActivity
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Update session metadata
  async handleUpdateMetadata(request) {
    const updates = await request.json();
    
    // Get existing metadata or create default
    const metadata = await this.storage.get('metadata') || {
      created: new Date().toISOString(),
      userId: 'anonymous',
      companyId: '',
      escalated: false,
      tags: []
    };
    
    // Update with new values
    const updatedMetadata = {
      ...metadata,
      ...updates,
      updated: new Date().toISOString()
    };
    
    await this.storage.put('metadata', updatedMetadata);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}