import { jwtVerify } from 'jose';

/**
 * Authentication middleware
 * Verifies JWT tokens and extracts user information
 */
export async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify the JWT token
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    // Add user info to the context
    c.set('user', {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'user',
      companyId: payload.companyId
    });
    
    // Ensure the user belongs to the company they're trying to access
    const requestCompanyId = c.get('companyId');
    if (payload.companyId !== requestCompanyId) {
      return c.json({ error: 'Unauthorized: Invalid company access' }, 403);
    }
    
    return next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }
}