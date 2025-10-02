/**
 * Admin Routes
 * Handles agent management, monitoring, and admin functionalities
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';

export function createAdminRoutes(authService, db) {
  const router = new Hono();

  // ==================== AGENT MANAGEMENT ====================

  /**
   * POST /api/admin/agents
   * Create a new agent account
   */
  router.post('/agents', async (c) => {
    try {
      const user = c.get('user');
      const companyId = c.get('companyId');

      const body = await c.req.json();
      const { name, email, role = 'company_agent' } = body;

      if (!name || !email) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'Name and email are required'
        }, 400);
      }

      // Validate role
      if (!['company_agent'].includes(role)) {
        return c.json({ error: 'Invalid role' }, 400);
      }

      // Check if email already exists
      const existingUser = await db.getUserByEmail(email, companyId);
      if (existingUser) {
        return c.json({ error: 'Email already exists' }, 409);
      }

      // Create agent
      const result = await authService.createAgent(db, companyId, name, email, role);

      // Create agent status record
      const statusId = uuidv4();
      await db.createOrUpdateAgentStatus(statusId, result.agentId, companyId, 'offline', 0, 5);

      return c.json({
        success: true,
        message: 'Agent created successfully',
        data: {
          agentId: result.agentId,
          email: result.email,
          temporaryPassword: result.temporaryPassword
        }
      }, 201);
    } catch (error) {
      console.error('Create agent error:', error);
      return c.json({ 
        error: 'Failed to create agent',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/admin/agents
   * Get all agents for a company
   */
  router.get('/agents', async (c) => {
    try {
      const companyId = c.get('companyId');

      const agents = await db.getUsersByCompany(companyId, 'company_agent');

      // Remove sensitive data
      const sanitizedAgents = agents.map(agent => {
        delete agent.password_hash;
        return agent;
      });

      return c.json({
        success: true,
        data: {
          agents: sanitizedAgents
        }
      });
    } catch (error) {
      console.error('Get agents error:', error);
      return c.json({ 
        error: 'Failed to get agents',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/admin/agents/:agentId
   * Get agent details
   */
  router.get('/agents/:agentId', async (c) => {
    try {
      const companyId = c.get('companyId');
      const agentId = c.req.param('agentId');

      const agent = await db.getUserById(agentId);

      if (!agent || agent.company_id !== companyId) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      // Remove sensitive data
      delete agent.password_hash;

      // Get agent status
      const status = await db.getAgentStatus(agentId);

      return c.json({
        success: true,
        data: {
          agent,
          status
        }
      });
    } catch (error) {
      console.error('Get agent error:', error);
      return c.json({ 
        error: 'Failed to get agent',
        message: error.message 
      }, 500);
    }
  });

  /**
   * PUT /api/admin/agents/:agentId
   * Update agent details
   */
  router.put('/agents/:agentId', async (c) => {
    try {
      const companyId = c.get('companyId');
      const agentId = c.req.param('agentId');

      const agent = await db.getUserById(agentId);

      if (!agent || agent.company_id !== companyId) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      const body = await c.req.json();
      const { name, email, role, status } = body;

      const updates = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (role && ['company_agent'].includes(role)) updates.role = role;
      if (status && ['active', 'inactive', 'suspended'].includes(status)) updates.status = status;

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      await db.updateUser(agentId, updates);

      return c.json({
        success: true,
        message: 'Agent updated successfully'
      });
    } catch (error) {
      console.error('Update agent error:', error);
      return c.json({ 
        error: 'Failed to update agent',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/admin/agents/:agentId/password-reset
   * Reset agent password
   */
  router.post('/agents/:agentId/password-reset', async (c) => {
    try {
      const companyId = c.get('companyId');
      const agentId = c.req.param('agentId');

      const agent = await db.getUserById(agentId);

      if (!agent || agent.company_id !== companyId) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      const temporaryPassword = authService.generateTemporaryPassword();
      await authService.resetPassword(db, agentId, temporaryPassword);

      return c.json({
        success: true,
        message: 'Password reset successfully',
        data: {
          temporaryPassword
        }
      });
    } catch (error) {
      console.error('Password reset error:', error);
      return c.json({ 
        error: 'Failed to reset password',
        message: error.message 
      }, 500);
    }
  });

  /**
   * DELETE /api/admin/agents/:agentId
   * Deactivate agent account
   */
  router.delete('/agents/:agentId', async (c) => {
    try {
      const companyId = c.get('companyId');
      const agentId = c.req.param('agentId');

      const agent = await db.getUserById(agentId);

      if (!agent || agent.company_id !== companyId) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      await db.updateUser(agentId, { status: 'inactive' });

      return c.json({
        success: true,
        message: 'Agent deactivated successfully'
      });
    } catch (error) {
      console.error('Deactivate agent error:', error);
      return c.json({ 
        error: 'Failed to deactivate agent',
        message: error.message 
      }, 500);
    }
  });

  // ==================== AGENT MONITORING ====================

  /**
   * GET /api/admin/agents/status
   * Get real-time status of all agents
   */
  router.get('/agents-status', async (c) => {
    try {
      const companyId = c.get('companyId');

      const agents = await db.getUsersByCompany(companyId, 'company_agent');
      const agentStatuses = [];

      for (const agent of agents) {
        const status = await db.getAgentStatus(agent.id);
        agentStatuses.push({
          agentId: agent.id,
          name: agent.name,
          email: agent.email,
          status: status?.status || 'offline',
          currentLoad: status?.current_load || 0,
          maxLoad: status?.max_load || 5,
          lastUpdated: status?.last_updated
        });
      }

      return c.json({
        success: true,
        data: {
          agents: agentStatuses
        }
      });
    } catch (error) {
      console.error('Get agent status error:', error);
      return c.json({ 
        error: 'Failed to get agent status',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/admin/queue
   * Get live queue view
   */
  router.get('/queue', async (c) => {
    try {
      const companyId = c.get('companyId');

      const pendingApprovals = await db.getApprovalRequests(companyId, 'pending');

      return c.json({
        success: true,
        data: {
          totalPendingApprovals: pendingApprovals.length,
          approvals: pendingApprovals
        }
      });
    } catch (error) {
      console.error('Get queue error:', error);
      return c.json({ 
        error: 'Failed to get queue',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/admin/queue/:requestId/reassign
   * Reassign approval request to another agent
   */
  router.post('/queue/:requestId/reassign', async (c) => {
    try {
      const companyId = c.get('companyId');
      const requestId = c.req.param('requestId');

      const body = await c.req.json();
      const { agentId } = body;

      if (!agentId) {
        return c.json({ error: 'Agent ID is required' }, 400);
      }

      // Verify agent belongs to the same company
      const agent = await db.getUserById(agentId);
      if (!agent || agent.company_id !== companyId) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      await db.assignApprovalRequest(requestId, agentId);

      return c.json({
        success: true,
        message: 'Request reassigned successfully'
      });
    } catch (error) {
      console.error('Reassign request error:', error);
      return c.json({ 
        error: 'Failed to reassign request',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/admin/performance/agents/:agentId
   * Get performance metrics for an agent
   */
  router.get('/performance/agents/:agentId', async (c) => {
    try {
      const companyId = c.get('companyId');
      const agentId = c.req.param('agentId');
      const startDate = c.req.query('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = c.req.query('endDate') || new Date().toISOString().split('T')[0];

      const agent = await db.getUserById(agentId);
      if (!agent || agent.company_id !== companyId) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      const metrics = await db.getPerformanceMetrics(agentId, startDate, endDate);

      return c.json({
        success: true,
        data: {
          agentId,
          agentName: agent.name,
          startDate,
          endDate,
          metrics
        }
      });
    } catch (error) {
      console.error('Get performance metrics error:', error);
      return c.json({ 
        error: 'Failed to get performance metrics',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/admin/performance/company
   * Get performance metrics for the entire company
   */
  router.get('/performance/company', async (c) => {
    try {
      const companyId = c.get('companyId');
      const startDate = c.req.query('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = c.req.query('endDate') || new Date().toISOString().split('T')[0];

      const metrics = await db.getCompanyPerformanceMetrics(companyId, startDate, endDate);

      // Aggregate metrics
      const aggregated = {
        totalConversations: 0,
        totalApprovalsHandled: 0,
        totalEscalations: 0,
        avgResponseTimeSeconds: 0,
        avgResolutionTimeSeconds: 0,
        avgCustomerSatisfactionScore: 0
      };

      let count = 0;
      for (const metric of metrics) {
        aggregated.totalConversations += metric.total_conversations || 0;
        aggregated.totalApprovalsHandled += metric.total_approvals_handled || 0;
        aggregated.totalEscalations += metric.total_escalations || 0;
        aggregated.avgResponseTimeSeconds += metric.avg_response_time_seconds || 0;
        aggregated.avgResolutionTimeSeconds += metric.avg_resolution_time_seconds || 0;
        aggregated.avgCustomerSatisfactionScore += metric.customer_satisfaction_score || 0;
        count++;
      }

      if (count > 0) {
        aggregated.avgResponseTimeSeconds /= count;
        aggregated.avgResolutionTimeSeconds /= count;
        aggregated.avgCustomerSatisfactionScore /= count;
      }

      return c.json({
        success: true,
        data: {
          companyId,
          startDate,
          endDate,
          aggregated,
          detailed: metrics
        }
      });
    } catch (error) {
      console.error('Get company performance metrics error:', error);
      return c.json({ 
        error: 'Failed to get company performance metrics',
        message: error.message 
      }, 500);
    }
  });

  // ==================== AGENT CONFIGURATION ====================

  /**
   * GET /api/admin/config
   * Get agent configuration
   */
  router.get('/config', async (c) => {
    try {
      const companyId = c.get('companyId');

      const config = await db.getAgentConfiguration(companyId);

      if (!config) {
        return c.json({ error: 'Configuration not found' }, 404);
      }

      return c.json({
        success: true,
        data: {
          config
        }
      });
    } catch (error) {
      console.error('Get config error:', error);
      return c.json({ 
        error: 'Failed to get configuration',
        message: error.message 
      }, 500);
    }
  });

  /**
   * PUT /api/admin/config
   * Update agent configuration
   */
  router.put('/config', async (c) => {
    try {
      const companyId = c.get('companyId');

      const body = await c.req.json();
      const updates = {};

      if (body.agentName) updates.agent_name = body.agentName;
      if (body.agentPersona) updates.agent_persona = body.agentPersona;
      if (body.brandingName) updates.branding_name = body.brandingName;
      if (body.brandingLogo) updates.branding_logo = body.brandingLogo;
      if (body.brandingPrimaryColor) updates.branding_primary_color = body.brandingPrimaryColor;
      if (body.greetingMessage) updates.greeting_message = body.greetingMessage;

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      await db.updateAgentConfiguration(companyId, updates);

      return c.json({
        success: true,
        message: 'Configuration updated successfully'
      });
    } catch (error) {
      console.error('Update config error:', error);
      return c.json({ 
        error: 'Failed to update configuration',
        message: error.message 
      }, 500);
    }
  });

  return router;
}
