# Multi-Tenant Customer Support Agent

A production-grade, multi-tenant customer support agent built using Cloudflare's AI Agents SDK. This system serves multiple companies, each with its own branding, tools, and customer service workflows.

## Features

- **Multi-Tenant Architecture**: Dynamically adapts based on `companyId` passed via headers, subdomain, or JWT
- **Semantic Memory**: Uses Cloudflare Vectorize DB with isolated namespaces per company
- **Custom Tool Invocation**: Companies define their own tools that the agent detects and invokes
- **Dynamic Prompt Engineering**: Injects company-specific tone, branding, and context into prompts
- **Durable Object State**: Maintains session history and context across multiple messages
- **Security & Isolation**: Authenticates users via JWT and isolates data per tenant
- **Scalable Deployment**: Uses Cloudflare Workers and Durable Objects for global edge deployment
- **Professional UI**: Responsive chat widget and admin panel with company-specific branding

## Project Structure

```
/
├── package.json           # Project dependencies
├── wrangler.toml          # Cloudflare Workers configuration
├── index.js               # Main application entry point
├── src/
│   ├── agent/
│   │   └── supportAgent.js # Core agent class with multi-tenant support
│   ├── config/
│   │   └── companyConfigManager.js # Company configuration management
│   ├── durable_objects/
│   │   └── chatSession.js  # Durable Object for session state
│   ├── memory/
│   │   └── vectorManager.js # Vectorize DB integration
│   ├── middleware/
│   │   ├── auth.js         # Authentication middleware
│   │   └── companyId.js    # Company ID extraction middleware
│   ├── security/
│   │   └── authUtils.js    # Security utilities
│   └── tools/
│       ├── toolRegistry.js # Tool registration and execution
│       └── exampleTools.js # Example tool implementations
└── public/
    ├── index.html         # Main UI HTML
    ├── styles.css         # UI styles
    └── app.js             # Frontend JavaScript
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (Cloudflare Workers CLI)
- Cloudflare account with Workers and AI access

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/multi-tenant-support-agent.git
cd multi-tenant-support-agent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Cloudflare credentials

Log in to your Cloudflare account using Wrangler:

```bash
npx wrangler login
```

### 4. Create Vectorize database

Create a Vectorize database for semantic memory:

```bash
npx wrangler vectorize create support-agent-index --dimensions=768
```

### 5. Update configuration

Edit the `wrangler.toml` file to update:
- Your worker name
- AI binding (Claude model)
- JWT secret (replace with a secure random string)

### 6. Deploy the application

```bash
npx wrangler deploy
```

## Local Development

### 1. Start the development server

```bash
npx wrangler dev
```

### 2. Access the application

Open your browser and navigate to:
- http://localhost:8787 (default port)

## Adding a New Company

1. Add the company configuration in `src/config/companyConfigManager.js`
2. Create a namespace in Vectorize for the company's knowledge base
3. Register company-specific tools in `src/tools/toolRegistry.js`
4. Upload company FAQs and knowledge base to Vectorize

Example company configuration:

```javascript
{
  companyId: 'company-1',
  agentName: 'SupportBot',
  branding: {
    companyName: 'TechCorp',
    primaryColor: '#4285F4',
    logo: '🖥️'
  },
  tone: 'professional',
  greeting: 'Welcome to TechCorp support! How can I assist you today?',
  vectorNamespace: 'techcorp-kb',
  tools: ['trackOrder', 'lookupAccount', 'reportIssue']
}
```

## Adding Custom Tools

1. Define your tool in a JavaScript file following the format in `src/tools/exampleTools.js`
2. Register the tool in the company configuration
3. The agent will automatically detect and invoke the tool when appropriate

Example tool definition:

```javascript
const myCustomTool = {
  name: 'myCustomTool',
  description: 'Description of what the tool does',
  parameters: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Description of parameter 1'
      }
    },
    required: ['param1']
  },
  handler: async ({ param1 }, { companyId, userId }) => {
    // Tool implementation
    return {
      success: true,
      data: { result: 'Tool output' }
    };
  }
};
```

## Production Deployment

For production deployment, ensure you:

1. Set up proper authentication with JWT
2. Configure a custom domain in Cloudflare
3. Set environment variables for secrets
4. Enable Durable Objects for session management
5. Set up proper CORS configuration for your domains

### Environment Variables

Set these in the Cloudflare dashboard or via Wrangler:

- `JWT_SECRET`: Secret key for JWT authentication
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS

## Security Considerations

- All API endpoints are protected with JWT authentication
- Company data is isolated by namespace in Vectorize
- Session data is isolated by company ID in Durable Objects
- Sensitive data should be encrypted using the provided utilities

## License

MIT