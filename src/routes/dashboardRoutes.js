/**
 * Dashboard Routes
 * Handles dashboard metrics, analytics, and overview data
 */

import { Hono } from 'hono';

export function createDashboardRoutes() {
  const router = new Hono();

  /**
   * GET /api/dashboard/metrics
   * Get dashboard overview metrics
   */
  router.get('/metrics', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');

      const metrics = await db.getDashboardMetrics(companyId);

      // Get today's conversations
      const todayConversations = await db.queryOne(
        `SELECT COUNT(*) as count FROM conversations 
         WHERE company_id = ? AND DATE(created_at) = DATE('now')`,
        [companyId]
      );

      // Get this week's conversations
      const weekConversations = await db.queryOne(
        `SELECT COUNT(*) as count FROM conversations 
         WHERE company_id = ? AND created_at >= datetime('now', '-7 days')`,
        [companyId]
      );

      // Get this month's conversations
      const monthConversations = await db.queryOne(
        `SELECT COUNT(*) as count FROM conversations 
         WHERE company_id = ? AND created_at >= datetime('now', 'start of month')`,
        [companyId]
      );

      // Get average response time (last 30 days)
      const avgResponseTime = await db.queryOne(
        `SELECT AVG(avg_response_time_seconds) as avg 
         FROM performance_metrics 
         WHERE company_id = ? AND date >= date('now', '-30 days')`,
        [companyId]
      );

      return c.json({
        success: true,
        data: {
          ...metrics,
          todayConversations: todayConversations?.count || 0,
          weekConversations: weekConversations?.count || 0,
          monthConversations: monthConversations?.count || 0,
          avgResponseTimeSeconds: avgResponseTime?.avg || 0
        }
      });
    } catch (error) {
      console.error('Get dashboard metrics error:', error);
      return c.json({ 
        error: 'Failed to get dashboard metrics',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/dashboard/activity
   * Get recent activity feed
   */
  router.get('/activity', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const limit = parseInt(c.req.query('limit') || '20');

      const activity = await db.getRecentActivity(companyId, limit);

      return c.json({
        success: true,
        data: {
          activity
        }
      });
    } catch (error) {
      console.error('Get activity error:', error);
      return c.json({ 
        error: 'Failed to get activity',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/dashboard/charts/conversations
   * Get conversation data for charts
   */
  router.get('/charts/conversations', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const days = parseInt(c.req.query('days') || '30');

      const conversationsOverTime = await db.query(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
          SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated
         FROM conversations
         WHERE company_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [companyId, days]
      );

      return c.json({
        success: true,
        data: {
          conversationsOverTime
        }
      });
    } catch (error) {
      console.error('Get conversation charts error:', error);
      return c.json({ 
        error: 'Failed to get conversation charts',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/dashboard/charts/agent-workload
   * Get agent workload distribution
   */
  router.get('/charts/agent-workload', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');

      const agentWorkload = await db.query(
        `SELECT 
          u.id as agent_id,
          u.name as agent_name,
          COALESCE(ast.current_load, 0) as current_load,
          COALESCE(ast.max_load, 5) as max_load,
          COUNT(DISTINCT c.id) as total_conversations
         FROM users u
         LEFT JOIN agent_status ast ON u.id = ast.agent_id
         LEFT JOIN conversations c ON u.id = c.agent_id AND c.status = 'active'
         WHERE u.company_id = ? AND u.role = 'company_agent'
         GROUP BY u.id, u.name, ast.current_load, ast.max_load`,
        [companyId]
      );

      return c.json({
        success: true,
        data: {
          agentWorkload
        }
      });
    } catch (error) {
      console.error('Get agent workload error:', error);
      return c.json({ 
        error: 'Failed to get agent workload',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/dashboard/charts/satisfaction
   * Get customer satisfaction trends
   */
  router.get('/charts/satisfaction', async (c) => {
    try {
      const db = c.get('db');
      const companyId = c.get('companyId');
      const days = parseInt(c.req.query('days') || '30');

      const satisfactionTrends = await db.query(
        `SELECT 
          DATE(created_at) as date,
          AVG(rating) as avg_rating,
          COUNT(*) as total_ratings
         FROM feedback
         WHERE company_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [companyId, days]
      );

      // Get rating distribution
      const ratingDistribution = await db.query(
        `SELECT 
          rating,
          COUNT(*) as count
         FROM feedback
         WHERE company_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
         GROUP BY rating
         ORDER BY rating ASC`,
        [companyId, days]
      );

      return c.json({
        success: true,
        data: {
          satisfactionTrends,
          ratingDistribution
        }
      });
    } catch (error) {
      console.error('Get satisfaction charts error:', error);
      return c.json({ 
        error: 'Failed to get satisfaction charts',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/dashboard/notifications
   * Get user notifications
   */
  router.get('/notifications', async (c) => {
    try {
      const db = c.get('db');
      const user = c.get('user');

      const notifications = await db.getUnreadNotifications(user.userId);

      return c.json({
        success: true,
        data: {
          notifications
        }
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      return c.json({ 
        error: 'Failed to get notifications',
        message: error.message 
      }, 500);
    }
  });

  /**
   * PUT /api/dashboard/notifications/:id/read
   * Mark notification as read
   */
  router.put('/notifications/:id/read', async (c) => {
    try {
      const db = c.get('db');
      const notificationId = c.req.param('id');

      await db.markNotificationAsRead(notificationId);

      return c.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      return c.json({ 
        error: 'Failed to mark notification as read',
        message: error.message 
      }, 500);
    }
  });

  /**
   * PUT /api/dashboard/notifications/read-all
   * Mark all notifications as read
   */
  router.put('/notifications/read-all', async (c) => {
    try {
      const db = c.get('db');
      const user = c.get('user');

      await db.markAllNotificationsAsRead(user.userId);

      return c.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      return c.json({ 
        error: 'Failed to mark all notifications as read',
        message: error.message 
      }, 500);
    }
  });

  return router;
}
