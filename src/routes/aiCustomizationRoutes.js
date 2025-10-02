/**
 * AI Customization Routes
 * Handles knowledge base, FAQs, custom tools, and workflows
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';

export function createAICustomizationRoutes(db) {
  const router = new Hono();

  // ==================== KNOWLEDGE BASE ====================

  /**
   * POST /api/ai/knowledge-base
   * Upload a document to the knowledge base
   */
  router.post('/knowledge-base', async (c) => {
    try {
      const companyId = c.get('companyId');

      const body = await c.req.json();
      const { title, content, fileType, fileUrl } = body;

      if (!title || !content) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'Title and content are required'
        }, 400);
      }

      const documentId = uuidv4();
      const vectorizeNamespace = `company_${companyId}_kb`;

      await db.createKnowledgeBaseDocument(
        documentId, companyId, title, content, fileType, fileUrl, vectorizeNamespace
      );

      // TODO: Trigger vectorization process
      // This would involve chunking the content, generating embeddings,
      // and storing them in Cloudflare Vectorize DB

      return c.json({
        success: true,
        message: 'Document uploaded successfully',
        data: {
          documentId
        }
      }, 201);
    } catch (error) {
      console.error('Upload document error:', error);
      return c.json({ 
        error: 'Failed to upload document',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/ai/knowledge-base
   * Get all knowledge base documents
   */
  router.get('/knowledge-base', async (c) => {
    try {
      const companyId = c.get('companyId');

      const documents = await db.getKnowledgeBaseDocuments(companyId);

      return c.json({
        success: true,
        data: {
          documents
        }
      });
    } catch (error) {
      console.error('Get documents error:', error);
      return c.json({ 
        error: 'Failed to get documents',
        message: error.message 
      }, 500);
    }
  });

  /**
   * PUT /api/ai/knowledge-base/:documentId
   * Update a knowledge base document
   */
  router.put('/knowledge-base/:documentId', async (c) => {
    try {
      const documentId = c.req.param('documentId');

      const body = await c.req.json();
      const updates = {};

      if (body.title) updates.title = body.title;
      if (body.content) updates.content = body.content;
      if (body.fileType) updates.file_type = body.fileType;
      if (body.fileUrl) updates.file_url = body.fileUrl;

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      await db.updateKnowledgeBaseDocument(documentId, updates);

      // TODO: Trigger re-vectorization if content changed

      return c.json({
        success: true,
        message: 'Document updated successfully'
      });
    } catch (error) {
      console.error('Update document error:', error);
      return c.json({ 
        error: 'Failed to update document',
        message: error.message 
      }, 500);
    }
  });

  /**
   * DELETE /api/ai/knowledge-base/:documentId
   * Delete a knowledge base document
   */
  router.delete('/knowledge-base/:documentId', async (c) => {
    try {
      const documentId = c.req.param('documentId');

      await db.deleteKnowledgeBaseDocument(documentId);

      return c.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      console.error('Delete document error:', error);
      return c.json({ 
        error: 'Failed to delete document',
        message: error.message 
      }, 500);
    }
  });

  // ==================== FAQ MANAGER ====================

  /**
   * POST /api/ai/faqs
   * Create a new FAQ
   */
  router.post('/faqs', async (c) => {
    try {
      const companyId = c.get('companyId');

      const body = await c.req.json();
      const { question, answer, keywords } = body;

      if (!question || !answer) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'Question and answer are required'
        }, 400);
      }

      const faqId = uuidv4();

      await db.createFAQ(faqId, companyId, question, answer, keywords);

      return c.json({
        success: true,
        message: 'FAQ created successfully',
        data: {
          faqId
        }
      }, 201);
    } catch (error) {
      console.error('Create FAQ error:', error);
      return c.json({ 
        error: 'Failed to create FAQ',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/ai/faqs
   * Get all FAQs
   */
  router.get('/faqs', async (c) => {
    try {
      const companyId = c.get('companyId');

      const faqs = await db.getFAQs(companyId);

      return c.json({
        success: true,
        data: {
          faqs
        }
      });
    } catch (error) {
      console.error('Get FAQs error:', error);
      return c.json({ 
        error: 'Failed to get FAQs',
        message: error.message 
      }, 500);
    }
  });

  /**
   * PUT /api/ai/faqs/:faqId
   * Update a FAQ
   */
  router.put('/faqs/:faqId', async (c) => {
    try {
      const faqId = c.req.param('faqId');

      const body = await c.req.json();
      const updates = {};

      if (body.question) updates.question = body.question;
      if (body.answer) updates.answer = body.answer;
      if (body.keywords) updates.keywords = body.keywords;

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      await db.updateFAQ(faqId, updates);

      return c.json({
        success: true,
        message: 'FAQ updated successfully'
      });
    } catch (error) {
      console.error('Update FAQ error:', error);
      return c.json({ 
        error: 'Failed to update FAQ',
        message: error.message 
      }, 500);
    }
  });

  /**
   * DELETE /api/ai/faqs/:faqId
   * Delete a FAQ
   */
  router.delete('/faqs/:faqId', async (c) => {
    try {
      const faqId = c.req.param('faqId');

      await db.deleteFAQ(faqId);

      return c.json({
        success: true,
        message: 'FAQ deleted successfully'
      });
    } catch (error) {
      console.error('Delete FAQ error:', error);
      return c.json({ 
        error: 'Failed to delete FAQ',
        message: error.message 
      }, 500);
    }
  });

  // ==================== CUSTOM TOOLS ====================

  /**
   * POST /api/ai/tools
   * Create a custom tool
   */
  router.post('/tools', async (c) => {
    try {
      const companyId = c.get('companyId');

      const body = await c.req.json();
      const { name, description, toolType, configuration } = body;

      if (!name || !toolType || !configuration) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'Name, toolType, and configuration are required'
        }, 400);
      }

      if (!['webhook', 'function'].includes(toolType)) {
        return c.json({ error: 'Invalid tool type' }, 400);
      }

      const toolId = uuidv4();

      await db.createCustomTool(toolId, companyId, name, description, toolType, configuration);

      return c.json({
        success: true,
        message: 'Custom tool created successfully',
        data: {
          toolId
        }
      }, 201);
    } catch (error) {
      console.error('Create custom tool error:', error);
      return c.json({ 
        error: 'Failed to create custom tool',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/ai/tools
   * Get all custom tools
   */
  router.get('/tools', async (c) => {
    try {
      const companyId = c.get('companyId');

      const tools = await db.getCustomTools(companyId);

      return c.json({
        success: true,
        data: {
          tools
        }
      });
    } catch (error) {
      console.error('Get custom tools error:', error);
      return c.json({ 
        error: 'Failed to get custom tools',
        message: error.message 
      }, 500);
    }
  });

  /**
   * PUT /api/ai/tools/:toolId
   * Update a custom tool
   */
  router.put('/tools/:toolId', async (c) => {
    try {
      const toolId = c.req.param('toolId');

      const body = await c.req.json();
      const updates = {};

      if (body.name) updates.name = body.name;
      if (body.description) updates.description = body.description;
      if (body.toolType && ['webhook', 'function'].includes(body.toolType)) {
        updates.tool_type = body.toolType;
      }
      if (body.configuration) updates.configuration = body.configuration;

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      await db.updateCustomTool(toolId, updates);

      return c.json({
        success: true,
        message: 'Custom tool updated successfully'
      });
    } catch (error) {
      console.error('Update custom tool error:', error);
      return c.json({ 
        error: 'Failed to update custom tool',
        message: error.message 
      }, 500);
    }
  });

  /**
   * DELETE /api/ai/tools/:toolId
   * Delete a custom tool
   */
  router.delete('/tools/:toolId', async (c) => {
    try {
      const toolId = c.req.param('toolId');

      await db.deleteCustomTool(toolId);

      return c.json({
        success: true,
        message: 'Custom tool deleted successfully'
      });
    } catch (error) {
      console.error('Delete custom tool error:', error);
      return c.json({ 
        error: 'Failed to delete custom tool',
        message: error.message 
      }, 500);
    }
  });

  // ==================== WORKFLOWS ====================

  /**
   * POST /api/ai/workflows
   * Create a workflow
   */
  router.post('/workflows', async (c) => {
    try {
      const companyId = c.get('companyId');

      const body = await c.req.json();
      const { name, description, triggerType, triggerValue, steps } = body;

      if (!name || !triggerType || !triggerValue || !steps) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'Name, triggerType, triggerValue, and steps are required'
        }, 400);
      }

      if (!['keyword', 'intent', 'action'].includes(triggerType)) {
        return c.json({ error: 'Invalid trigger type' }, 400);
      }

      const workflowId = uuidv4();

      await db.createWorkflow(workflowId, companyId, name, description, triggerType, triggerValue, steps);

      return c.json({
        success: true,
        message: 'Workflow created successfully',
        data: {
          workflowId
        }
      }, 201);
    } catch (error) {
      console.error('Create workflow error:', error);
      return c.json({ 
        error: 'Failed to create workflow',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/ai/workflows
   * Get all workflows
   */
  router.get('/workflows', async (c) => {
    try {
      const companyId = c.get('companyId');

      const workflows = await db.getWorkflows(companyId);

      return c.json({
        success: true,
        data: {
          workflows
        }
      });
    } catch (error) {
      console.error('Get workflows error:', error);
      return c.json({ 
        error: 'Failed to get workflows',
        message: error.message 
      }, 500);
    }
  });

  /**
   * PUT /api/ai/workflows/:workflowId
   * Update a workflow
   */
  router.put('/workflows/:workflowId', async (c) => {
    try {
      const workflowId = c.req.param('workflowId');

      const body = await c.req.json();
      const updates = {};

      if (body.name) updates.name = body.name;
      if (body.description) updates.description = body.description;
      if (body.triggerType && ['keyword', 'intent', 'action'].includes(body.triggerType)) {
        updates.trigger_type = body.triggerType;
      }
      if (body.triggerValue) updates.trigger_value = body.triggerValue;
      if (body.steps) updates.steps = body.steps;

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      await db.updateWorkflow(workflowId, updates);

      return c.json({
        success: true,
        message: 'Workflow updated successfully'
      });
    } catch (error) {
      console.error('Update workflow error:', error);
      return c.json({ 
        error: 'Failed to update workflow',
        message: error.message 
      }, 500);
    }
  });

  /**
   * DELETE /api/ai/workflows/:workflowId
   * Delete a workflow
   */
  router.delete('/workflows/:workflowId', async (c) => {
    try {
      const workflowId = c.req.param('workflowId');

      await db.deleteWorkflow(workflowId);

      return c.json({
        success: true,
        message: 'Workflow deleted successfully'
      });
    } catch (error) {
      console.error('Delete workflow error:', error);
      return c.json({ 
        error: 'Failed to delete workflow',
        message: error.message 
      }, 500);
    }
  });

  return router;
}
