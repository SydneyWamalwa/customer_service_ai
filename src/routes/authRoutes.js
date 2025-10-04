/**
 * Authentication Routes
 * Handles user registration, login, logout, and authentication
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';

// CHANGED: Remove parameters - get services from context instead
export function createAuthRoutes() {
  const router = new Hono();

  /**
   * POST /api/auth/register
   * Register a new company and admin user
   */
  router.post('/register', async (c) => {
    try {
      // Get services from context
      const db = c.get('db');
      const authService = c.get('authService');

      const body = await c.req.json();
      const { companyName, companyEmail, adminName, adminEmail, adminPassword } = body;

      // Validate required fields
      if (!companyName || !companyEmail || !adminName || !adminEmail || !adminPassword) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'All fields are required: companyName, companyEmail, adminName, adminEmail, adminPassword'
        }, 400);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(companyEmail) || !emailRegex.test(adminEmail)) {
        return c.json({ error: 'Invalid email format' }, 400);
      }

      // Validate password strength
      if (adminPassword.length < 8) {
        return c.json({ 
          error: 'Password too weak',
          message: 'Password must be at least 8 characters long'
        }, 400);
      }

      // Register company and admin
      const result = await authService.registerCompany(
        db, companyName, companyEmail, adminName, adminEmail, adminPassword
      );

      // Create default agent configuration
      const configId = uuidv4();
      await db.createAgentConfiguration(configId, result.companyId, {
        agentName: `${companyName} Support`,
        agentPersona: 'professional and helpful',
        brandingName: companyName,
        brandingLogo: '🤖',
        brandingPrimaryColor: '#4285F4',
        greetingMessage: `Welcome to ${companyName} support! How can I assist you today?`
      });

      return c.json({
        success: true,
        message: 'Company registered successfully',
        data: {
          token: result.token,
          user: result.user,
          companyId: result.companyId
        }
      }, 201);
    } catch (error) {
      console.error('Registration error:', error);
      return c.json({ 
        error: 'Registration failed',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/auth/login
   * Login for Company Admins and Agents
   */
  router.post('/login', async (c) => {
    try {
      // Get services from context
      const db = c.get('db');
      const authService = c.get('authService');

      const body = await c.req.json();
      const { email, password, companyId } = body;

      if (!email || !password || !companyId) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'Email, password, and companyId are required'
        }, 400);
      }

      const result = await authService.login(db, email, password, companyId);

      return c.json({
        success: true,
        message: 'Login successful',
        data: {
          token: result.token,
          user: result.user
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return c.json({ 
        error: 'Login failed',
        message: error.message 
      }, 401);
    }
  });

  /**
   * POST /api/auth/customer/authenticate
   * Authenticate customer (anonymous or registered)
   */
  router.post('/customer/authenticate', async (c) => {
    try {
      // Get services from context
      const db = c.get('db');
      const authService = c.get('authService');

      const body = await c.req.json();
      const { companyId, customerId, email, password } = body;

      if (!companyId) {
        return c.json({ 
          error: 'Missing required field',
          message: 'companyId is required'
        }, 400);
      }

      const result = await authService.authenticateCustomer(db, companyId, customerId, email, password);

      return c.json({
        success: true,
        message: 'Authentication successful',
        data: {
          token: result.token,
          user: result.user
        }
      });
    } catch (error) {
      console.error('Customer authentication error:', error);
      return c.json({ 
        error: 'Authentication failed',
        message: error.message 
      }, 401);
    }
  });

  /**
   * POST /api/auth/logout
   * Logout user (requires authentication)
   */
  router.post('/logout', async (c) => {
    try {
      // Get services from context
      const authService = c.get('authService');
      const db = c.get('db');

      const authHeader = c.req.header('Authorization');
      
      if (!authHeader) {
        return c.json({ error: 'Authorization header missing' }, 401);
      }

      const token = authService.extractTokenFromHeader(authHeader);
      
      if (!token) {
        return c.json({ error: 'Invalid authorization format' }, 401);
      }

      await authService.logout(db, token);

      return c.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      return c.json({ 
        error: 'Logout failed',
        message: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/auth/password/reset
   * Reset password (requires authentication)
   */
  router.post('/password/reset', async (c) => {
    try {
      // Get services from context
      const db = c.get('db');
      const authService = c.get('authService');

      const user = c.get('user');
      
      if (!user) {
        return c.json({ error: 'User not authenticated' }, 401);
      }

      const body = await c.req.json();
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return c.json({ 
          error: 'Missing required fields',
          message: 'currentPassword and newPassword are required'
        }, 400);
      }

      if (newPassword.length < 8) {
        return c.json({ 
          error: 'Password too weak',
          message: 'Password must be at least 8 characters long'
        }, 400);
      }

      // Get user from database
      const dbUser = await db.getUserById(user.userId);
      
      if (!dbUser) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Verify current password
      const isValid = await authService.verifyPassword(currentPassword, dbUser.password_hash);
      
      if (!isValid) {
        return c.json({ error: 'Current password is incorrect' }, 401);
      }

      // Reset password
      await authService.resetPassword(db, user.userId, newPassword);

      return c.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      return c.json({ 
        error: 'Password reset failed',
        message: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/auth/me
   * Get current user info (requires authentication)
   */
  router.get('/me', async (c) => {
    try {
      // Get services from context
      const db = c.get('db');

      const user = c.get('user');
      
      if (!user) {
        return c.json({ error: 'User not authenticated' }, 401);
      }

      // Get full user details from database
      const dbUser = await db.getUserById(user.userId);
      
      if (!dbUser) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Remove sensitive data
      delete dbUser.password_hash;

      return c.json({
        success: true,
        data: {
          user: dbUser
        }
      });
    } catch (error) {
      console.error('Get user info error:', error);
      return c.json({ 
        error: 'Failed to get user info',
        message: error.message 
      }, 500);
    }
  });

  return router;
}