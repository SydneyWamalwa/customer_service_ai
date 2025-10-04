/**
 * Token Manager
 * Handles JWT access tokens and refresh tokens
 */

import { SignJWT, jwtVerify } from 'jose';
import { v4 as uuidv4 } from 'uuid';

export class TokenManager {
  constructor(jwtSecret) {
    this.jwtSecret = new TextEncoder().encode(jwtSecret);
    this.accessTokenExpiry = '24h'; // 24 hours
    this.refreshTokenExpiry = '7d'; // 7 days
  }

  /**
   * Generate an access token (JWT)
   */
  async generateAccessToken(payload) {
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.accessTokenExpiry)
      .setJti(uuidv4()) // Unique token ID
      .sign(this.jwtSecret);
    
    return token;
  }

  /**
   * Generate a refresh token
   */
  async generateRefreshToken(userId, db) {
    const tokenId = uuidv4();
    const token = uuidv4() + uuidv4(); // Long random token
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Store refresh token in database
    await db.createRefreshToken(tokenId, userId, token, expiresAt.toISOString());

    return token;
  }

  /**
   * Verify an access token
   */
  async verifyAccessToken(token) {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify a refresh token
   */
  async verifyRefreshToken(token, db) {
    const refreshToken = await db.getRefreshToken(token);

    if (!refreshToken) {
      throw new Error('Invalid refresh token');
    }

    if (refreshToken.revoked) {
      throw new Error('Refresh token has been revoked');
    }

    const expiresAt = new Date(refreshToken.expires_at);
    if (expiresAt < new Date()) {
      throw new Error('Refresh token has expired');
    }

    return refreshToken;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken, db) {
    // Verify refresh token
    const tokenData = await this.verifyRefreshToken(refreshToken, db);

    // Get user data
    const user = await db.getUserById(tokenData.user_id);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.status !== 'active') {
      throw new Error('User account is not active');
    }

    // Generate new access token
    const accessToken = await this.generateAccessToken({
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email
    });

    return {
      accessToken,
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
   * Revoke a refresh token
   */
  async revokeRefreshToken(token, db) {
    await db.revokeRefreshToken(token);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId, db) {
    await db.revokeAllUserRefreshTokens(userId);
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens(db) {
    await db.deleteExpiredRefreshTokens();
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
   * Calculate expiration date for access token
   */
  calculateAccessTokenExpiration() {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    return expiresAt.toISOString();
  }

  /**
   * Calculate expiration date for refresh token
   */
  calculateRefreshTokenExpiration() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt.toISOString();
  }
}
