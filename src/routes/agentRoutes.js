/**
 * Agent Routes
 * Handles agent-specific functionalities like approval management and status updates
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';

export function createAgentRoutes(db) {
  const router = new Hono();

  // ==================== AGENT STATUS ====================

  /**
   * POST /api/agent/status
   * Update agent status
   */
  router.post('/status', async (c) => {
    try {
      const user = c.get('user');
      const companyId = c.get('companyId');

      const body = await c.req.json();
      const { status, maxLoad } = body;

      if (!status) {
        return c.json({ error: 'Status is required' }, 400);
      }

      if (!['online', 'offline', 'busy', 'away', 'on_break'].includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      const statusId = uuidv4();
      await db.createOrUpdateAgentStatus(
        statusId, 
        user.userId, 
        companyId, 
        status, 
        0, // current_load will be managed by the system
        maxLoad || 5
      );

      return c.json({
        success: true,
        message: 'Status updated successfully'
      });
    } catch (error) {
      console.error('Update status error:', error);
      return c.json({ 
        error: 'Failed to update status',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/agent/status
   * Get current agent status
   */
  router.get('/status', async (c) => {
    try {
      const user = c.get('user');

      const status = await db.getAgentStatus(user.userId);

      if (!status) {
        return c.json({
          success: true,
          data: {
            status: 'offline',
            currentLoad: 0,
            maxLoad: 5
          }
        });
      }

      return c.json({
        success: true,
        data: {
          status: status.status,
          currentLoad: status.current_load,
          maxLoad: status.max_load,
          lastUpdated: status.last_updated
        }
      });
    } catch (error) {
      console.error('Get status error:', error);
      return c.json({ 
        error: 'Failed to get status',
        message: error.message 
      }, 500);
    }
  });

  // ==================== APPROVAL REQUESTS ====================

  /**
   * GET /api/agent/approvals
   * Get approval requests for the agent
   */
  router.get('/approvals', async (c) => {
    try {
      const companyId = c.get('companyId');
      const status = c.req.query('status') || 'pending';

      const approvals = await db.getApprovalRequests(companyId, status);

      return c.json({
        success: true,
        data: {
          approvals
        }
      });
    } catch (error) {
      console.error('Get approvals error:', error);
      return c.json({ 
        error: 'Failed to get approvals',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/agent/approvals/:requestId/approve
   * Approve a request
   */
  router.post('/approvals/:requestId/approve', async (c) => {
    try {
      const user = c.get('user');
      const requestId = c.req.param('requestId');

      const body = await c.req.json();
      const { feedback } = body;

      await db.updateApprovalRequest(requestId, {
        status: 'approved',
        agent_id: user.userId,
        agent_feedback: feedback,
        resolved_at: new Date().toISOString()
      });

      return c.json({
        success: true,
        message: 'Request approved successfully'
      });
    } catch (error) {
      console.error('Approve request error:', error);
      return c.json({ 
        error: 'Failed to approve request',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/agent/approvals/:requestId/reject
   * Reject a request
   */
  router.post('/approvals/:requestId/reject', async (c) => {
    try {
      const user = c.get('user');
      const requestId = c.req.param('requestId');

      const body = await c.req.json();
      const { feedback } = body;

      if (!feedback) {
        return c.json({ 
          error: 'Feedback is required when rejecting a request' 
        }, 400);
      }

      await db.updateApprovalRequest(requestId, {
        status: 'rejected',
        agent_id: user.userId,
        agent_feedback: feedback,
        resolved_at: new Date().toISOString()
      });

      return c.json({
        success: true,
        message: 'Request rejected successfully'
      });
    } catch (error) {
      console.error('Reject request error:', error);
      return c.json({ 
        error: 'Failed to reject request',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/agent/approvals/:requestId/escalate
   * Escalate a request
   */
  router.post('/approvals/:requestId/escalate', async (c) => {
    try {
      const user = c.get('user');
      const requestId = c.req.param('requestId');

      const body = await c.req.json();
      const { feedback, escalateTo } = body;

      const updates = {
        status: 'escalated',
        agent_feedback: feedback
      };

      if (escalateTo) {
        updates.agent_id = escalateTo;
      }

      await db.updateApprovalRequest(requestId, updates);

      return c.json({
        success: true,
        message: 'Request escalated successfully'
      });
    } catch (error) {
      console.error('Escalate request error:', error);
      return c.json({ 
        error: 'Failed to escalate request',
        message: error.message 
      }, 500);
    }
  });

  // ==================== CONVERSATIONS ====================

  /**
   * GET /api/agent/conversations
   * Get conversations assigned to the agent
   */
  router.get('/conversations', async (c) => {
    try {
      const user = c.get('user');
      const companyId = c.get('companyId');

      // Get all conversations where agent_id matches
      const sql = `SELECT * FROM conversations WHERE agent_id = ? AND company_id = ? ORDER BY updated_at DESC`;
      const conversations = await db.query(sql, [user.userId, companyId]);

      return c.json({
        success: true,
        data: {
          conversations: conversations.map(conv => ({
            ...conv,
            messages: JSON.parse(conv.messages)
          }))
        }
      });
    } catch (error) {
      console.error('Get conversations error:', error);
      return c.json({ 
        error: 'Failed to get conversations',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/agent/conversations/:conversationId/takeover
   * Take over a conversation
   */
  router.post('/conversations/:conversationId/takeover', async (c) => {
    try {
      const user = c.get('user');
      const conversationId = c.req.param('conversationId');

      await db.updateConversation(conversationId, {
        agent_id: user.userId,
        status: 'active'
      });

      return c.json({
        success: true,
        message: 'Conversation taken over successfully'
      });
    } catch (error) {
      console.error('Takeover conversation error:', error);
      return c.json({ 
        error: 'Failed to take over conversation',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/agent/conversations/:conversationId/close
   * Close a conversation
   */
  router.post('/conversations/:conversationId/close', async (c) => {
    try {
      const conversationId = c.req.param('conversationId');

      await db.updateConversation(conversationId, {
        status: 'closed',
        closed_at: new Date().toISOString()
      });

      return c.json({
        success: true,
        message: 'Conversation closed successfully'
      });
    } catch (error) {
      console.error('Close conversation error:', error);
      return c.json({ 
        error: 'Failed to close conversation',
        message: error.message 
      }, 500);
    }
  });

  // ==================== PERFORMANCE ====================

  /**
   * GET /api/agent/performance
   * Get agent's own performance metrics
   */
  router.get('/performance', async (c) => {
    try {
      const user = c.get('user');
      const startDate = c.req.query('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = c.req.query('endDate') || new Date().toISOString().split('T')[0];

      const metrics = await db.getPerformanceMetrics(user.userId, startDate, endDate);

      return c.json({
        success: true,
        data: {
          startDate,
          endDate,
          metrics
        }
      });
    } catch (error) {
      console.error('Get performance error:', error);
      return c.json({ 
        error: 'Failed to get performance metrics',
        message: error.message 
      }, 500);
    }
  });

  return router;
}
