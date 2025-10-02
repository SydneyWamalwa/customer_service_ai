-- Multi-Tenant Customer Service AI Platform Database Schema

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
    subscription_tier TEXT DEFAULT 'basic' CHECK(subscription_tier IN ('basic', 'pro', 'enterprise'))
);

-- Users Table (Company Admins, Agents, and Customers)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('company_admin', 'company_agent', 'customer')),
    name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
    last_login TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE(email, company_id)
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Agent Configuration Table
CREATE TABLE IF NOT EXISTS agent_configurations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,
    agent_name TEXT NOT NULL,
    agent_persona TEXT,
    branding_name TEXT,
    branding_logo TEXT,
    branding_primary_color TEXT,
    greeting_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Knowledge Base Documents Table
CREATE TABLE IF NOT EXISTS knowledge_base_documents (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_type TEXT,
    file_url TEXT,
    vectorize_namespace TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'processing')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- FAQ Table
CREATE TABLE IF NOT EXISTS faqs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Custom Tools Table
CREATE TABLE IF NOT EXISTS custom_tools (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    tool_type TEXT NOT NULL CHECK(tool_type IN ('webhook', 'function')),
    configuration TEXT NOT NULL, -- JSON string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Workflows Table
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK(trigger_type IN ('keyword', 'intent', 'action')),
    trigger_value TEXT NOT NULL,
    steps TEXT NOT NULL, -- JSON string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Agent Skills Table
CREATE TABLE IF NOT EXISTS agent_skills (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    skill_level TEXT DEFAULT 'intermediate' CHECK(skill_level IN ('beginner', 'intermediate', 'expert')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(agent_id, skill_name)
);

-- Agent Status Table
CREATE TABLE IF NOT EXISTS agent_status (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL UNIQUE,
    company_id TEXT NOT NULL,
    status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'busy', 'away', 'on_break')),
    current_load INTEGER DEFAULT 0,
    max_load INTEGER DEFAULT 5,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Approval Requests Table
CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    customer_id TEXT,
    agent_id TEXT,
    conversation_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    customer_message TEXT NOT NULL,
    conversation_history TEXT, -- JSON string
    proposed_action TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    urgency TEXT NOT NULL CHECK(urgency IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'escalated')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    agent_feedback TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    customer_id TEXT,
    agent_id TEXT,
    session_id TEXT NOT NULL,
    messages TEXT NOT NULL, -- JSON string
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed', 'escalated')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Performance Metrics Table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_conversations INTEGER DEFAULT 0,
    total_approvals_handled INTEGER DEFAULT 0,
    total_escalations INTEGER DEFAULT 0,
    avg_response_time_seconds INTEGER DEFAULT 0,
    avg_resolution_time_seconds INTEGER DEFAULT 0,
    customer_satisfaction_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE(agent_id, date)
);

-- Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    customer_id TEXT,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_company_id ON sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_company_id ON knowledge_base_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_faqs_company_id ON faqs(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_tools_company_id ON custom_tools(company_id);
CREATE INDEX IF NOT EXISTS idx_workflows_company_id ON workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_id ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_status_company_id ON agent_status(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_company_id ON approval_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_agent_id ON approval_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_conversations_company_id ON conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_id ON performance_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_company_id ON performance_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_feedback_company_id ON feedback(company_id);
