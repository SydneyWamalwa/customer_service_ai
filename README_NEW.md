# Multi-Tenant Customer Service AI Platform

A comprehensive, globally distributed customer service AI platform built on Cloudflare's edge infrastructure. This platform enables companies to deploy customized AI agents with multi-tenant isolation, advanced agent management, and seamless integration capabilities.

## 🚀 Features

### Core Capabilities

- **Multi-Tenancy & Data Isolation**: Complete data separation between companies
- **AI-Powered Support**: Intelligent customer service with context-aware responses
- **Agent Management**: Comprehensive tools for managing human agents
- **Queue Management**: Smart routing and prioritization of customer requests
- **Knowledge Base**: Upload and manage company-specific documentation
- **FAQ Management**: Create and maintain frequently asked questions
- **Custom Tools**: Integrate webhooks and custom functions
- **Workflow Builder**: Define automated workflows based on triggers
- **Performance Analytics**: Track agent and company-wide metrics
- **Embeddable Chat Widget**: Easy integration into any website

### User Roles

1. **Company Admin**: Full access to configuration, agent management, and analytics
2. **Company Agent**: Access to approval queue, conversations, and own performance metrics
3. **Customer**: Anonymous or registered users interacting with the AI agent

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Cloudflare Workers (Serverless compute)
- Hono (Web framework)
- D1 Database (Distributed SQLite)
- Vectorize DB (Vector database for semantic search)
- Durable Objects (Stateful chat sessions)
- JWT Authentication

**Frontend:**
- React 18
- React Router
- Tailwind CSS
- shadcn/ui components
- Lucide Icons
- Recharts (Analytics)

### Project Structure

```
customer_service_ai/
├── src/
│   ├── database/
│   │   ├── schema.sql              # Database schema
│   │   └── databaseManager.js      # Database operations
│   ├── security/
│   │   └── authService.js          # Authentication service
│   ├── middleware/
│   │   └── authMiddleware.js       # Auth middleware
│   ├── routes/
│   │   ├── authRoutes.js           # Auth endpoints
│   │   ├── adminRoutes.js          # Admin endpoints
│   │   ├── aiCustomizationRoutes.js # AI customization
│   │   └── agentRoutes.js          # Agent endpoints
│   ├── agent/
│   │   └── supportAgent.js         # Core AI agent
│   ├── config/
│   │   └── companyConfigManager.js # Company config
│   ├── durable_objects/
│   │   └── chatSession.js          # Chat sessions
│   ├── memory/
│   │   └── vectorManager.js        # Vector DB manager
│   ├── tools/
│   │   ├── toolRegistry.js         # Tool registry
│   │   └── exampleTools.js         # Example tools
│   └── index_new.js                # Main application
├── admin-dashboard/                # React admin dashboard
│   ├── src/
│   │   ├── pages/                  # Page components
│   │   ├── components/             # Reusable components
│   │   └── App.jsx                 # Main app component
│   └── package.json
├── wrangler_new.toml               # Cloudflare Workers config
├── IMPLEMENTATION_GUIDE.md         # Detailed implementation guide
└── README_NEW.md                   # This file
```

## 📦 Installation

### Prerequisites

- Node.js (v16 or later)
- npm or pnpm
- Cloudflare account
- Wrangler CLI

### Setup

1. **Clone the repository**

```bash
git clone https://github.com/SydneyWamalwa/customer_service_ai.git
cd customer_service_ai
```

2. **Install dependencies**

```bash
npm install
```

3. **Create D1 Database**

```bash
npx wrangler d1 create customer_service_db
```

Note the `database_id` from the output and update `wrangler_new.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "customer_service_db"
database_id = "YOUR_DATABASE_ID_HERE"
```

4. **Initialize Database Schema**

```bash
npx wrangler d1 execute customer_service_db --file=src/database/schema.sql
```

5. **Create Vectorize Index**

```bash
npx wrangler vectorize create support-agent-index --dimensions=768
```

6. **Configure Environment Variables**

Update `wrangler_new.toml`:

```toml
[vars]
JWT_SECRET = "your-secure-random-secret-here"
ALLOWED_ORIGINS = "*"
```

7. **Deploy Backend**

```bash
# Copy the new files
cp src/index_new.js src/index.js
cp wrangler_new.toml wrangler.toml

# Deploy
npx wrangler deploy
```

8. **Set up Admin Dashboard**

```bash
cd admin-dashboard
pnpm install
pnpm run dev
```

## 🎯 Quick Start

### 1. Register a Company

```bash
curl -X POST https://your-worker-url.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "TechCorp",
    "companyEmail": "admin@techcorp.com",
    "adminName": "John Doe",
    "adminEmail": "john@techcorp.com",
    "adminPassword": "securePassword123"
  }'
```

### 2. Login

```bash
curl -X POST https://your-worker-url.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@techcorp.com",
    "password": "securePassword123",
    "companyId": "YOUR_COMPANY_ID"
  }'
```

### 3. Configure AI Agent

```bash
curl -X PUT https://your-worker-url.workers.dev/api/admin/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentName": "TechCorp Support",
    "agentPersona": "professional and helpful",
    "brandingName": "TechCorp",
    "brandingPrimaryColor": "#4285F4",
    "greetingMessage": "Welcome to TechCorp! How can I help you today?"
  }'
```

### 4. Create an Agent

```bash
curl -X POST https://your-worker-url.workers.dev/api/admin/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@techcorp.com",
    "role": "company_agent"
  }'
```

### 5. Test Chat

```bash
curl -X POST https://your-worker-url.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Company-ID: YOUR_COMPANY_ID" \
  -d '{
    "message": "I need help with my order",
    "companyId": "YOUR_COMPANY_ID"
  }'
```

## 📚 API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new company |
| `/api/auth/login` | POST | Login admin/agent |
| `/api/auth/customer/authenticate` | POST | Authenticate customer |
| `/api/auth/logout` | POST | Logout user |
| `/api/auth/password/reset` | POST | Reset password |
| `/api/auth/me` | GET | Get current user |

### Admin (Company Admin Only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/agents` | POST | Create agent |
| `/api/admin/agents` | GET | List agents |
| `/api/admin/agents/:id` | GET | Get agent details |
| `/api/admin/agents/:id` | PUT | Update agent |
| `/api/admin/agents/:id` | DELETE | Deactivate agent |
| `/api/admin/agents-status` | GET | Get agent statuses |
| `/api/admin/queue` | GET | Get approval queue |
| `/api/admin/performance/company` | GET | Company metrics |
| `/api/admin/config` | GET/PUT | Agent configuration |

### AI Customization (Company Admin Only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/knowledge-base` | POST/GET | Manage documents |
| `/api/ai/faqs` | POST/GET | Manage FAQs |
| `/api/ai/tools` | POST/GET | Manage custom tools |
| `/api/ai/workflows` | POST/GET | Manage workflows |

### Agent (Company Agent Only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/status` | POST/GET | Update/get status |
| `/api/agent/approvals` | GET | Get approval requests |
| `/api/agent/approvals/:id/approve` | POST | Approve request |
| `/api/agent/approvals/:id/reject` | POST | Reject request |
| `/api/agent/conversations` | GET | Get conversations |
| `/api/agent/performance` | GET | Get own metrics |

### Public

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Chat with AI |
| `/api/feedback` | POST | Submit feedback |
| `/api/widget/config/:companyId` | GET | Get widget config |

## 🔒 Security

### Implemented Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: SHA-256 password hashing
- **Data Isolation**: Company-scoped database queries
- **RBAC**: Role-based access control
- **CORS**: Configurable CORS policies
- **Input Validation**: Server-side validation
- **SQL Injection Prevention**: Parameterized queries

### Best Practices

1. Change `JWT_SECRET` to a secure random string
2. Use HTTPS in production
3. Implement rate limiting
4. Monitor logs and set up alerts
5. Regular database backups
6. Keep dependencies updated

## 🧪 Testing

### Run Tests

```bash
npm test
```

### Manual Testing

1. Register a company via `/api/auth/register`
2. Login via `/api/auth/login`
3. Create agents via `/api/admin/agents`
4. Configure AI via `/api/admin/config`
5. Upload knowledge base documents
6. Test chat functionality
7. Monitor queue and performance

## 📊 Performance Metrics

The platform tracks:

- **Agent Metrics**: Conversations handled, response time, resolution time
- **Company Metrics**: Total conversations, escalations, customer satisfaction
- **Queue Metrics**: Pending approvals, average wait time
- **System Metrics**: API latency, error rates

## 🌐 Deployment

### Cloudflare Workers

```bash
npx wrangler deploy
```

### Admin Dashboard

```bash
cd admin-dashboard
pnpm run build
# Deploy to Cloudflare Pages, Vercel, or Netlify
```

### Environment Variables

Set these in Cloudflare Workers dashboard:

- `JWT_SECRET`: Secret for JWT signing
- `ALLOWED_ORIGINS`: CORS allowed origins

## 🔧 Configuration

### Agent Configuration

Customize your AI agent:

- **Agent Name**: Display name for the AI
- **Agent Persona**: Personality and tone
- **Branding**: Logo, colors, company name
- **Greeting Message**: Initial message to customers

### Knowledge Base

Upload documents in various formats:
- PDF
- Word documents
- Text files
- Markdown

### Custom Tools

Create custom integrations:
- **Webhooks**: Call external APIs
- **Functions**: Custom JavaScript functions

### Workflows

Define automated workflows:
- **Triggers**: Keywords, intents, actions
- **Steps**: Sequential actions to perform

## 📖 Documentation

- [Implementation Guide](./IMPLEMENTATION_GUIDE.md) - Detailed technical documentation
- [API Reference](./IMPLEMENTATION_GUIDE.md#api-endpoints) - Complete API documentation
- [Database Schema](./src/database/schema.sql) - Database structure

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Cloudflare Workers for the serverless platform
- Hono for the lightweight web framework
- shadcn/ui for beautiful UI components
- OpenAI for AI capabilities

## 📧 Support

For issues or questions:
- Open an issue on GitHub
- Check the [Implementation Guide](./IMPLEMENTATION_GUIDE.md)
- Review the [Design Document](./Comprehensive_Design_Document_Multi-Tenant_Customer_Service_AI_Platform.pdf)

---

**Built with ❤️ using Cloudflare Workers and React**
