/**
 * Authentication and Authorization Middleware
 * Implements JWT verification and RBAC (Role-Based Access Control)
 */

import { AuthService } from '../security/authService.js';
import { DatabaseManager } from '../database/databaseManager.js';

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticate = (authService, db) => {
  return async (c, next) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader) {
        return c.json({ error: 'Authorization header missing' }, 401);
      }

      const token = authService.extractTokenFromHeader(authHeader);
      
      if (!token) {
        return c.json({ error: 'Invalid authorization format' }, 401);
      }

      // Validate token and get user info
      const payload = await authService.validateToken(db, token);

      // Attach user info to context
      c.set('user', {
        userId: payload.userId,
        companyId: payload.companyId,
        role: payload.role,
        email: payload.email,
        anonymous: payload.anonymous || false
      });

      await next();
    } catch (error) {
      console.error('Authentication error:', error);
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
  };
};

/**
 * Middleware to authorize based on user roles
 */
export const authorize = (...allowedRoles) => {
  return async (c, next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ 
        error: 'Forbidden', 
        message: 'You do not have permission to access this resource' 
      }, 403);
    }

    await next();
  };
};

/**
 * Middleware to ensure data isolation by company ID
 */
export const enforceDataIsolation = () => {
  return async (c, next) => {
    const user = c.get('user');
    const requestedCompanyId = c.req.param('companyId') || c.req.query('companyId');

    // If a company ID is specified in the request, ensure it matches the user's company
    if (requestedCompanyId && requestedCompanyId !== user.companyId) {
      return c.json({ 
        error: 'Forbidden', 
        message: 'You cannot access data from another company' 
      }, 403);
    }

    // Attach company ID to context for use in handlers
    c.set('companyId', user.companyId);

    await next();
  };
};

/**
 * Optional authentication middleware (allows anonymous access)
 */
export const optionalAuthenticate = (authService, db) => {
  return async (c, next) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (authHeader) {
        const token = authService.extractTokenFromHeader(authHeader);
        
        if (token) {
          try {
            const payload = await authService.validateToken(db, token);
            c.set('user', {
              userId: payload.userId,
              companyId: payload.companyId,
              role: payload.role,
              email: payload.email,
              anonymous: payload.anonymous || false
            });
          } catch (error) {
            // Token is invalid, but we allow anonymous access
            console.warn('Invalid token in optional auth:', error.message);
          }
        }
      }

      await next();
    } catch (error) {
      console.error('Optional authentication error:', error);
      await next();
    }
  };
};

/**
 * Middleware to extract company ID from various sources
 */
export const extractCompanyId = () => {
  return async (c, next) => {
    // Try to get company ID from:
    // 1. User context (if authenticated)
    // 2. X-Company-ID header
    // 3. Query parameter
    // 4. Request body
    
    const user = c.get('user');
    let companyId = user?.companyId;

    if (!companyId) {
      companyId = c.req.header('X-Company-ID') || 
                  c.req.query('companyId') || 
                  c.req.param('companyId');
    }

    if (!companyId) {
      try {
        const body = await c.req.json();
        companyId = body.companyId;
      } catch (error) {
        // Body is not JSON or doesn't exist
      }
    }

    if (!companyId) {
      return c.json({ error: 'Company ID is required' }, 400);
    }

    c.set('companyId', companyId);
    await next();
  };
};

/**
 * Rate limiting middleware (basic implementation)
 */
export const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  const requests = new Map();

  return async (c, next) => {
    const user = c.get('user');
    const key = user?.userId || c.req.header('CF-Connecting-IP') || 'anonymous';
    
    const now = Date.now();
    const userRequests = requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return c.json({ 
        error: 'Too many requests', 
        message: 'Please try again later' 
      }, 429);
    }
    
    validRequests.push(now);
    requests.set(key, validRequests);
    
    await next();
  };
};
