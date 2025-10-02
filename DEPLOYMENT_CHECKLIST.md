# Deployment Checklist

This checklist ensures a smooth deployment of the Multi-Tenant Customer Service AI Platform.

## Pre-Deployment

### 1. Environment Setup

- [ ] Cloudflare account created
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Authenticated with Cloudflare (`wrangler login`)
- [ ] Node.js v16+ installed
- [ ] pnpm installed (`npm install -g pnpm`)

### 2. Database Setup

- [ ] D1 database created
  ```bash
  npx wrangler d1 create customer_service_db
  ```
- [ ] Database ID added to `wrangler.toml`
- [ ] Schema initialized
  ```bash
  npx wrangler d1 execute customer_service_db --file=src/database/schema.sql
  ```
- [ ] Database connection tested

### 3. Vectorize Setup

- [ ] Vectorize index created
  ```bash
  npx wrangler vectorize create support-agent-index --dimensions=768
  ```
- [ ] Index name added to `wrangler.toml`

### 4. Configuration

- [ ] `wrangler.toml` updated with correct values
- [ ] `JWT_SECRET` set to a secure random string
- [ ] `ALLOWED_ORIGINS` configured
- [ ] AI binding configured
- [ ] Durable Objects configured

### 5. Code Preparation

- [ ] All dependencies installed (`npm install`)
- [ ] Code linted and formatted
- [ ] Tests passing
- [ ] `src/index_new.js` copied to `src/index.js`
- [ ] `wrangler_new.toml` copied to `wrangler.toml`

## Backend Deployment

### 6. Deploy to Cloudflare Workers

- [ ] Deploy command executed
  ```bash
  npx wrangler deploy
  ```
- [ ] Deployment successful
- [ ] Worker URL noted
- [ ] Health check endpoint tested
  ```bash
  curl https://your-worker-url.workers.dev/health
  ```

### 7. Verify Backend

- [ ] Registration endpoint tested
- [ ] Login endpoint tested
- [ ] Chat endpoint tested
- [ ] Admin endpoints tested (with auth)
- [ ] Error handling verified

## Frontend Deployment

### 8. Admin Dashboard Build

- [ ] Navigate to `admin-dashboard` directory
- [ ] Dependencies installed (`pnpm install`)
- [ ] API base URL updated in components
- [ ] Build command executed
  ```bash
  pnpm run build
  ```
- [ ] Build successful (check `dist` folder)

### 9. Deploy Admin Dashboard

Choose one deployment method:

#### Option A: Cloudflare Pages

- [ ] Connect GitHub repository to Cloudflare Pages
- [ ] Build settings configured:
  - Build command: `pnpm run build`
  - Build output directory: `dist`
  - Root directory: `admin-dashboard`
- [ ] Deployment successful
- [ ] Custom domain configured (optional)

#### Option B: Vercel

- [ ] Vercel CLI installed
- [ ] Deploy command executed
  ```bash
  vercel --prod
  ```
- [ ] Deployment successful

#### Option C: Netlify

- [ ] Netlify CLI installed
- [ ] Deploy command executed
  ```bash
  netlify deploy --prod
  ```
- [ ] Deployment successful

### 10. Verify Frontend

- [ ] Admin dashboard accessible
- [ ] Login page loads correctly
- [ ] Registration works
- [ ] Dashboard displays after login
- [ ] All pages accessible
- [ ] API calls working
- [ ] No console errors

## Post-Deployment

### 11. Initial Configuration

- [ ] Register first company via API or UI
- [ ] Login as company admin
- [ ] Configure AI agent settings
- [ ] Upload test knowledge base document
- [ ] Create test FAQ
- [ ] Create test agent account

### 12. Integration Testing

- [ ] Test complete user flow:
  - [ ] Company registration
  - [ ] Admin login
  - [ ] Agent creation
  - [ ] Agent login
  - [ ] Customer chat (anonymous)
  - [ ] Customer chat (authenticated)
  - [ ] Approval request creation
  - [ ] Agent approval workflow
  - [ ] Feedback submission
  - [ ] Performance metrics display

### 13. Security Verification

- [ ] JWT authentication working
- [ ] Role-based access control enforced
- [ ] Data isolation verified (create 2 companies, ensure data separation)
- [ ] CORS configured correctly
- [ ] HTTPS enforced
- [ ] Sensitive data not exposed in responses

### 14. Performance Testing

- [ ] Load testing performed
- [ ] Response times acceptable (<500ms for most endpoints)
- [ ] Database queries optimized
- [ ] Vectorize queries working
- [ ] Durable Objects functioning correctly

### 15. Monitoring Setup

- [ ] Cloudflare Workers analytics enabled
- [ ] Error logging configured
- [ ] Performance monitoring set up
- [ ] Alerts configured for:
  - [ ] High error rates
  - [ ] Slow response times
  - [ ] Database connection issues

### 16. Documentation

- [ ] API documentation accessible
- [ ] Admin user guide created
- [ ] Agent user guide created
- [ ] Integration guide for chat widget created
- [ ] Troubleshooting guide created

### 17. Backup and Recovery

- [ ] Database backup strategy defined
- [ ] Backup schedule configured
- [ ] Recovery procedure documented
- [ ] Test restore performed

## Chat Widget Integration

### 18. Widget Deployment

- [ ] Widget JavaScript file created
- [ ] Widget hosted on CDN or Workers
- [ ] Widget configuration endpoint tested
- [ ] Sample integration code created

### 19. Widget Testing

- [ ] Widget loads on test page
- [ ] Chat functionality works
- [ ] Branding displays correctly
- [ ] Messages sent and received
- [ ] Feedback form works

## Optional Enhancements

### 20. Advanced Features

- [ ] Email notifications configured
- [ ] SMS notifications configured (optional)
- [ ] Webhook integrations tested
- [ ] Custom tools deployed
- [ ] Workflows activated

### 21. Mobile SDKs (Future)

- [ ] iOS SDK planned
- [ ] Android SDK planned
- [ ] React Native SDK planned

## Production Checklist

### 22. Final Verification

- [ ] All endpoints returning correct responses
- [ ] No hardcoded credentials in code
- [ ] Environment variables properly set
- [ ] Rate limiting configured
- [ ] CORS properly restricted
- [ ] Error messages don't expose sensitive info
- [ ] Logging doesn't include PII

### 23. Go-Live

- [ ] DNS configured (if using custom domain)
- [ ] SSL certificates valid
- [ ] All stakeholders notified
- [ ] Support team trained
- [ ] Monitoring dashboard accessible
- [ ] Incident response plan ready

### 24. Post-Launch

- [ ] Monitor for 24 hours
- [ ] Check error rates
- [ ] Review performance metrics
- [ ] Gather user feedback
- [ ] Plan first update/patch

## Rollback Plan

### 25. Rollback Preparation

- [ ] Previous version tagged in Git
- [ ] Rollback procedure documented
- [ ] Database migration rollback scripts ready
- [ ] Communication plan for rollback

## Maintenance

### 26. Regular Tasks

- [ ] Weekly: Review error logs
- [ ] Weekly: Check performance metrics
- [ ] Monthly: Update dependencies
- [ ] Monthly: Review and optimize database
- [ ] Quarterly: Security audit
- [ ] Quarterly: Backup restore test

## Support

### 27. Support Setup

- [ ] Support email configured
- [ ] Support ticket system set up
- [ ] FAQ page created
- [ ] Community forum set up (optional)

---

## Quick Commands Reference

### Development
```bash
# Start local development
npx wrangler dev

# Start admin dashboard dev server
cd admin-dashboard && pnpm run dev
```

### Deployment
```bash
# Deploy backend
npx wrangler deploy

# Build frontend
cd admin-dashboard && pnpm run build
```

### Database
```bash
# Execute SQL
npx wrangler d1 execute customer_service_db --file=query.sql

# Backup database
npx wrangler d1 backup create customer_service_db
```

### Monitoring
```bash
# View logs
npx wrangler tail

# View analytics
# Visit Cloudflare dashboard
```

---

## Troubleshooting

### Common Issues

**Issue: Database not found**
- Solution: Verify database_id in wrangler.toml matches created database

**Issue: JWT token invalid**
- Solution: Check JWT_SECRET is set correctly in environment variables

**Issue: CORS errors**
- Solution: Update ALLOWED_ORIGINS in wrangler.toml

**Issue: Vectorize queries failing**
- Solution: Verify index name and dimensions match configuration

**Issue: Durable Objects not working**
- Solution: Ensure migrations are properly configured in wrangler.toml

---

## Success Criteria

Deployment is successful when:

✅ All API endpoints return expected responses
✅ Admin dashboard is accessible and functional
✅ Users can register, login, and perform actions
✅ Chat functionality works end-to-end
✅ Data isolation is verified
✅ Performance meets requirements (<500ms response time)
✅ No critical errors in logs
✅ Monitoring and alerts are active

---

**Last Updated**: [Current Date]
**Version**: 2.0.0
**Deployment Environment**: Production
