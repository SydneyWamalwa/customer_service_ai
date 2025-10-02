/**
 * Authentication Service
 * Handles user authentication, JWT generation, and password management
 */

import { SignJWT, jwtVerify } from 'jose';
import { v4 as uuidv4 } from 'uuid';

export class AuthService {
  constructor(jwtSecret) {
    this.jwtSecret = new TextEncoder().encode(jwtSecret);
    this.tokenExpiry = '24h'; // 24 hours
  }

  /**
   * Hash a password using Web Crypto API
   */
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password, hash) {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }

  /**
   * Generate a JWT token
   */
  async generateToken(payload) {
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.tokenExpiry)
      .sign(this.jwtSecret);
    
    return token;
  }

  /**
   * Verify and decode a JWT token
   */
  async verifyToken(token) {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Generate a temporary password
   */
  generateTemporaryPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }
    
    return password;
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Calculate token expiration date
   */
  calculateExpirationDate() {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    return expiresAt.toISOString();
  }

  /**
   * Register a new company and admin user
   */
  async registerCompany(db, companyName, companyEmail, adminName, adminEmail, adminPassword) {
    const companyId = uuidv4();
    const adminId = uuidv4();
    const passwordHash = await this.hashPassword(adminPassword);

    // Create company
    await db.createCompany(companyId, companyName, companyEmail);

    // Create admin user
    await db.createUser(adminId, companyId, adminEmail, passwordHash, 'company_admin', adminName);

    // Generate JWT token
    const token = await this.generateToken({
      userId: adminId,
      companyId: companyId,
      role: 'company_admin',
      email: adminEmail
    });

    // Create session
    const sessionId = uuidv4();
    const expiresAt = this.calculateExpirationDate();
    await db.createSession(sessionId, adminId, companyId, token, expiresAt, null, null);

    return {
      companyId,
      adminId,
      token,
      user: {
        id: adminId,
        name: adminName,
        email: adminEmail,
        role: 'company_admin',
        companyId: companyId
      }
    };
  }

  /**
   * Login a user (Company Admin or Agent)
   */
  async login(db, email, password, companyId) {
    // Get user by email and company
    const user = await db.getUserByEmail(email, companyId);
    
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new Error('Account is inactive');
    }

    // Generate JWT token
    const token = await this.generateToken({
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email
    });

    // Create session
    const sessionId = uuidv4();
    const expiresAt = this.calculateExpirationDate();
    await db.createSession(sessionId, user.id, user.company_id, token, expiresAt, null, null);

    // Update last login
    await db.updateLastLogin(user.id);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.company_id
      }
    };
  }

  /**
   * Authenticate customer (anonymous or registered)
   */
  async authenticateCustomer(db, companyId, customerId = null, email = null, password = null) {
    if (!customerId && !email) {
      // Generate anonymous customer ID
      customerId = `anon_${uuidv4()}`;
      
      const token = await this.generateToken({
        userId: customerId,
        companyId: companyId,
        role: 'customer',
        email: null,
        anonymous: true
      });

      return {
        token,
        user: {
          id: customerId,
          role: 'customer',
          companyId: companyId,
          anonymous: true
        }
      };
    }

    // Registered customer login
    if (email && password) {
      const user = await db.getUserByEmail(email, companyId);
      
      if (!user || user.role !== 'customer') {
        throw new Error('Invalid email or password');
      }

      const isValid = await this.verifyPassword(password, user.password_hash);
      
      if (!isValid) {
        throw new Error('Invalid email or password');
      }

      const token = await this.generateToken({
        userId: user.id,
        companyId: user.company_id,
        role: user.role,
        email: user.email,
        anonymous: false
      });

      const sessionId = uuidv4();
      const expiresAt = this.calculateExpirationDate();
      await db.createSession(sessionId, user.id, user.company_id, token, expiresAt, null, null);

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.company_id,
          anonymous: false
        }
      };
    }

    throw new Error('Invalid authentication parameters');
  }

  /**
   * Logout a user
   */
  async logout(db, token) {
    const session = await db.getSessionByToken(token);
    
    if (session) {
      await db.deleteSession(session.id);
    }
  }

  /**
   * Validate token and get user info
   */
  async validateToken(db, token) {
    try {
      const payload = await this.verifyToken(token);
      
      // Check if session exists and is valid
      const session = await db.getSessionByToken(token);
      
      if (!session) {
        throw new Error('Session not found or expired');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Create a new agent account
   */
  async createAgent(db, companyId, name, email, role = 'company_agent') {
    const agentId = uuidv4();
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.hashPassword(temporaryPassword);

    await db.createUser(agentId, companyId, email, passwordHash, role, name);

    return {
      agentId,
      email,
      temporaryPassword,
      message: 'Agent account created successfully. Please send the temporary password securely to the agent.'
    };
  }

  /**
   * Reset password
   */
  async resetPassword(db, userId, newPassword) {
    const passwordHash = await this.hashPassword(newPassword);
    await db.updateUser(userId, { password_hash: passwordHash });
  }
}
