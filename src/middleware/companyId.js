/**
 * Company ID middleware
 * Extracts company ID from request headers, subdomain, or JWT
 */
export function getCompanyIdMiddleware(c, next) {
  let companyId;
  
  // Try to get company ID from header
  companyId = c.req.header('X-Company-ID');
  
  // If not in header, try to extract from subdomain
  if (!companyId) {
    const host = c.req.header('Host');
    if (host && host.includes('.')) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'www' && subdomain !== 'app') {
        companyId = subdomain;
      }
    }
  }
  
  // If still not found, try to get from JWT if available
  if (!companyId) {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // Simple JWT parsing (not verification, that happens in auth middleware)
        const payload = JSON.parse(atob(token.split('.')[1]));
        companyId = payload.companyId;
      } catch (e) {
        // JWT parsing failed, continue
      }
    }
  }
  
  // If still not found, try to get from query parameter (for development only)
  if (!companyId) {
    companyId = c.req.query('companyId');
  }
  
  // Set company ID in context or use default
  c.set('companyId', companyId || 'company-1');
  
  return next();
}