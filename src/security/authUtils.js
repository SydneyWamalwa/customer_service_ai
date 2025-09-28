import { SignJWT, jwtVerify } from 'jose';

/**
 * Authentication utilities for the multi-tenant support agent
 */
export class AuthUtils {
  constructor(env) {
    this.env = env;
    this.jwtSecret = env.JWT_SECRET;
  }

  /**
   * Generate a JWT token for a user
   */
  async generateToken(user, companyId, expiresIn = '24h') {
    const secret = new TextEncoder().encode(this.jwtSecret);
    
    const jwt = await new SignJWT({
      email: user.email,
      role: user.role || 'user',
      companyId
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(secret);
    
    return jwt;
  }

  /**
   * Verify a JWT token
   */
  async verifyToken(token) {
    try {
      const secret = new TextEncoder().encode(this.jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      
      return {
        valid: true,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role || 'user',
          companyId: payload.companyId
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Encrypt sensitive data
   */
  encryptData(data) {
    // In a production environment, use a proper encryption library
    // For this implementation, we'll use a simple base64 encoding
    return btoa(JSON.stringify(data));
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData) {
    // In a production environment, use a proper encryption library
    // For this implementation, we'll use a simple base64 decoding
    try {
      return JSON.parse(atob(encryptedData));
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a user has permission for an action
   */
  hasPermission(user, action, resource) {
    // Simple permission check based on user role
    if (user.role === 'admin') {
      return true;
    }
    
    // For regular users, check specific permissions
    const userPermissions = {
      user: {
        chat: ['read', 'write'],
        feedback: ['create'],
        account: ['read']
      },
      support: {
        chat: ['read', 'write'],
        feedback: ['read', 'respond'],
        account: ['read'],
        tickets: ['read', 'update']
      }
    };
    
    const rolePermissions = userPermissions[user.role] || userPermissions.user;
    const resourcePermissions = rolePermissions[resource] || [];
    
    return resourcePermissions.includes(action);
  }
}