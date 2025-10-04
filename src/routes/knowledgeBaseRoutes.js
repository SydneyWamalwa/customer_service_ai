/**
 * Knowledge Base Routes
 * Handles document and FAQ management
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';

export function createKnowledgeBaseRoutes() {
  const router = new Hono();

  // ==================== DOCUMENT MANAGEMENT ====================

  /**
   * GET /api/knowledge-base/documents
   * Get all documents
   */
  router.get('/documents', async (c) => {
    try {
      const db = c.get('db');
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
   * GET /api/knowledge-base/documents/:id
   * Get document by ID
   */
  router.get('/documents/:id', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const documentId = c.req.param('id');

      const document = await db.queryOne(
        'SELECT * FROM knowledge_base_documents WHERE id = ? AND company_id = ?',
        [documentId, companyId]
      );

      if (!document) {
        return c.json({ error: 'Document not found' }, 404);
      }

      return c.json({
        success: true,
        data: {
          document
        }
      });
    } catch (error) {
      console.error('Get document error:', error);
      return c.json({ 
        error: 'Failed to get document',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/knowledge-base/documents
   * Create a new document
   */
  router.post('/documents', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const user = c.get('user');

      const body = await c.req.json();
      const { title, content, fileType, fileUrl } = body;

      if (!title || !content) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'Title and content are required'
        }, 400);
      }

      const documentId = uuidv4();
      const vectorizeNamespace = `${companyId}-kb`;

      await db.createKnowledgeBaseDocument(
        documentId, companyId, title, content, fileType || 'text', fileUrl || null, vectorizeNamespace
      );

      // Create audit log
      const auditId = uuidv4();
      await db.createAuditLog(
        auditId, user.userId, companyId, 'document_created', 'knowledge_base_document', documentId,
        JSON.stringify({ title }), null, null
      );

      return c.json({
        success: true,
        message: 'Document created successfully',
        data: {
          documentId
        }
      }, 201);
    } catch (error) {
      console.error('Create document error:', error);
      return c.json({ 
        error: 'Failed to create document',
        message: error.message 
      }, 500);
    }
  });

  /**
   * PUT /api/knowledge-base/documents/:id
   * Update a document
   */
  router.put('/documents/:id', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const user = c.get('user');
      const documentId = c.req.param('id');

      const document = await db.queryOne(
        'SELECT * FROM knowledge_base_documents WHERE id = ? AND company_id = ?',
        [documentId, companyId]
      );

      if (!document) {
        return c.json({ error: 'Document not found' }, 404);
      }

      const body = await c.req.json();
      const updates = {};

      if (body.title) updates.title = body.title;
      if (body.content) updates.content = body.content;
      if (body.fileType) updates.file_type = body.fileType;
      if (body.fileUrl) updates.file_url = body.fileUrl;
      if (body.status) updates.status = body.status;

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), documentId, companyId];
      const sql = `UPDATE knowledge_base_documents SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`;
      await db.execute(sql, values);

      // Create audit log
      const auditId = uuidv4();
      await db.createAuditLog(
        auditId, user.userId, companyId, 'document_updated', 'knowledge_base_document', documentId,
        JSON.stringify(updates), null, null
      );

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
   * DELETE /api/knowledge-base/documents/:id
   * Delete a document
   */
  router.delete('/documents/:id', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const user = c.get('user');
      const documentId = c.req.param('id');

      const document = await db.queryOne(
        'SELECT * FROM knowledge_base_documents WHERE id = ? AND company_id = ?',
        [documentId, companyId]
      );

      if (!document) {
        return c.json({ error: 'Document not found' }, 404);
      }

      await db.execute(
        'DELETE FROM knowledge_base_documents WHERE id = ? AND company_id = ?',
        [documentId, companyId]
      );

      // Create audit log
      const auditId = uuidv4();
      await db.createAuditLog(
        auditId, user.userId, companyId, 'document_deleted', 'knowledge_base_document', documentId,
        JSON.stringify({ title: document.title }), null, null
      );

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

  // ==================== FAQ MANAGEMENT ====================

  /**
   * GET /api/knowledge-base/faqs
   * Get all FAQs
   */
  router.get('/faqs', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');

      const faqs = await db.query(
        'SELECT * FROM faqs WHERE company_id = ? AND status = ? ORDER BY created_at DESC',
        [companyId, 'active']
      );

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
   * GET /api/knowledge-base/faqs/:id
   * Get FAQ by ID
   */
  router.get('/faqs/:id', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const faqId = c.req.param('id');

      const faq = await db.queryOne(
        'SELECT * FROM faqs WHERE id = ? AND company_id = ?',
        [faqId, companyId]
      );

      if (!faq) {
        return c.json({ error: 'FAQ not found' }, 404);
      }

      return c.json({
        success: true,
        data: {
          faq
        }
      });
    } catch (error) {
      console.error('Get FAQ error:', error);
      return c.json({ 
        error: 'Failed to get FAQ',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/knowledge-base/faqs
   * Create a new FAQ
   */
  router.post('/faqs', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const user = c.get('user');

      const body = await c.req.json();
      const { question, answer, keywords } = body;

      if (!question || !answer) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'Question and answer are required'
        }, 400);
      }

      const faqId = uuidv4();

      await db.execute(
        'INSERT INTO faqs (id, company_id, question, answer, keywords) VALUES (?, ?, ?, ?, ?)',
        [faqId, companyId, question, answer, keywords || null]
      );

      // Create audit log
      const auditId = uuidv4();
      await db.createAuditLog(
        auditId, user.userId, companyId, 'faq_created', 'faq', faqId,
        JSON.stringify({ question }), null, null
      );

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
   * PUT /api/knowledge-base/faqs/:id
   * Update a FAQ
   */
  router.put('/faqs/:id', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const user = c.get('user');
      const faqId = c.req.param('id');

      const faq = await db.queryOne(
        'SELECT * FROM faqs WHERE id = ? AND company_id = ?',
        [faqId, companyId]
      );

      if (!faq) {
        return c.json({ error: 'FAQ not found' }, 404);
      }

      const body = await c.req.json();
      const updates = {};

      if (body.question) updates.question = body.question;
      if (body.answer) updates.answer = body.answer;
      if (body.keywords !== undefined) updates.keywords = body.keywords;
      if (body.status) updates.status = body.status;

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), faqId, companyId];
      const sql = `UPDATE faqs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`;
      await db.execute(sql, values);

      // Create audit log
      const auditId = uuidv4();
      await db.createAuditLog(
        auditId, user.userId, companyId, 'faq_updated', 'faq', faqId,
        JSON.stringify(updates), null, null
      );

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
   * DELETE /api/knowledge-base/faqs/:id
   * Delete a FAQ
   */
  router.delete('/faqs/:id', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const user = c.get('user');
      const faqId = c.req.param('id');

      const faq = await db.queryOne(
        'SELECT * FROM faqs WHERE id = ? AND company_id = ?',
        [faqId, companyId]
      );

      if (!faq) {
        return c.json({ error: 'FAQ not found' }, 404);
      }

      await db.execute(
        'DELETE FROM faqs WHERE id = ? AND company_id = ?',
        [faqId, companyId]
      );

      // Create audit log
      const auditId = uuidv4();
      await db.createAuditLog(
        auditId, user.userId, companyId, 'faq_deleted', 'faq', faqId,
        JSON.stringify({ question: faq.question }), null, null
      );

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

  return router;
}
