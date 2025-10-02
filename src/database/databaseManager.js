/**
 * Database Manager for Cloudflare D1
 * Handles all database operations with multi-tenant data isolation
 */

export class DatabaseManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Execute a query with automatic company ID filtering for data isolation
   */
  async query(sql, params = []) {
    try {
      const result = await this.db.prepare(sql).bind(...params).all();
      return result.results || [];
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Execute a single row query
   */
  async queryOne(sql, params = []) {
    try {
      const result = await this.db.prepare(sql).bind(...params).first();
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Execute an insert/update/delete query
   */
  async execute(sql, params = []) {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      return result;
    } catch (error) {
      console.error('Database execute error:', error);
      throw new Error(`Database execute failed: ${error.message}`);
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries) {
    try {
      const statements = queries.map(({ sql, params }) => 
        this.db.prepare(sql).bind(...params)
      );
      const results = await this.db.batch(statements);
      return results;
    } catch (error) {
      console.error('Database transaction error:', error);
      throw new Error(`Database transaction failed: ${error.message}`);
    }
  }

  // ==================== COMPANY OPERATIONS ====================

  async createCompany(id, name, email, subscriptionTier = 'basic') {
    const sql = `
      INSERT INTO companies (id, name, email, subscription_tier)
      VALUES (?, ?, ?, ?)
    `;
    return await this.execute(sql, [id, name, email, subscriptionTier]);
  }

  async getCompanyById(companyId) {
    const sql = `SELECT * FROM companies WHERE id = ?`;
    return await this.queryOne(sql, [companyId]);
  }

  async updateCompany(companyId, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), companyId];
    const sql = `UPDATE companies SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, values);
  }

  // ==================== USER OPERATIONS ====================

  async createUser(id, companyId, email, passwordHash, role, name) {
    const sql = `
      INSERT INTO users (id, company_id, email, password_hash, role, name)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [id, companyId, email, passwordHash, role, name]);
  }

  async getUserByEmail(email, companyId) {
    const sql = `SELECT * FROM users WHERE email = ? AND company_id = ?`;
    return await this.queryOne(sql, [email, companyId]);
  }

  async getUserById(userId) {
    const sql = `SELECT * FROM users WHERE id = ?`;
    return await this.queryOne(sql, [userId]);
  }

  async updateUser(userId, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), userId];
    const sql = `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, values);
  }

  async getUsersByCompany(companyId, role = null) {
    let sql = `SELECT * FROM users WHERE company_id = ?`;
    const params = [companyId];
    
    if (role) {
      sql += ` AND role = ?`;
      params.push(role);
    }
    
    return await this.query(sql, params);
  }

  async updateLastLogin(userId) {
    const sql = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, [userId]);
  }

  // ==================== SESSION OPERATIONS ====================

  async createSession(id, userId, companyId, token, expiresAt, ipAddress, userAgent) {
    const sql = `
      INSERT INTO sessions (id, user_id, company_id, token, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [id, userId, companyId, token, expiresAt, ipAddress, userAgent]);
  }

  async getSessionByToken(token) {
    const sql = `SELECT * FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP`;
    return await this.queryOne(sql, [token]);
  }

  async deleteSession(sessionId) {
    const sql = `DELETE FROM sessions WHERE id = ?`;
    return await this.execute(sql, [sessionId]);
  }

  async deleteExpiredSessions() {
    const sql = `DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP`;
    return await this.execute(sql);
  }

  // ==================== AGENT CONFIGURATION OPERATIONS ====================

  async createAgentConfiguration(id, companyId, config) {
    const sql = `
      INSERT INTO agent_configurations 
      (id, company_id, agent_name, agent_persona, branding_name, branding_logo, 
       branding_primary_color, greeting_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [
      id, companyId, config.agentName, config.agentPersona, 
      config.brandingName, config.brandingLogo, config.brandingPrimaryColor, 
      config.greetingMessage
    ]);
  }

  async getAgentConfiguration(companyId) {
    const sql = `SELECT * FROM agent_configurations WHERE company_id = ?`;
    return await this.queryOne(sql, [companyId]);
  }

  async updateAgentConfiguration(companyId, config) {
    const fields = Object.keys(config).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(config), companyId];
    const sql = `UPDATE agent_configurations SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?`;
    return await this.execute(sql, values);
  }

  // ==================== KNOWLEDGE BASE OPERATIONS ====================

  async createKnowledgeBaseDocument(id, companyId, title, content, fileType, fileUrl, vectorizeNamespace) {
    const sql = `
      INSERT INTO knowledge_base_documents 
      (id, company_id, title, content, file_type, file_url, vectorize_namespace)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [id, companyId, title, content, fileType, fileUrl, vectorizeNamespace]);
  }

  async getKnowledgeBaseDocuments(companyId) {
    const sql = `SELECT * FROM knowledge_base_documents WHERE company_id = ? AND status = 'active'`;
    return await this.query(sql, [companyId]);
  }

  async updateKnowledgeBaseDocument(documentId, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), documentId];
    const sql = `UPDATE knowledge_base_documents SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, values);
  }

  async deleteKnowledgeBaseDocument(documentId) {
    const sql = `UPDATE knowledge_base_documents SET status = 'inactive' WHERE id = ?`;
    return await this.execute(sql, [documentId]);
  }

  // ==================== FAQ OPERATIONS ====================

  async createFAQ(id, companyId, question, answer, keywords) {
    const sql = `
      INSERT INTO faqs (id, company_id, question, answer, keywords)
      VALUES (?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [id, companyId, question, answer, keywords]);
  }

  async getFAQs(companyId) {
    const sql = `SELECT * FROM faqs WHERE company_id = ? AND status = 'active'`;
    return await this.query(sql, [companyId]);
  }

  async updateFAQ(faqId, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), faqId];
    const sql = `UPDATE faqs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, values);
  }

  async deleteFAQ(faqId) {
    const sql = `UPDATE faqs SET status = 'inactive' WHERE id = ?`;
    return await this.execute(sql, [faqId]);
  }

  // ==================== CUSTOM TOOLS OPERATIONS ====================

  async createCustomTool(id, companyId, name, description, toolType, configuration) {
    const sql = `
      INSERT INTO custom_tools (id, company_id, name, description, tool_type, configuration)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [id, companyId, name, description, toolType, JSON.stringify(configuration)]);
  }

  async getCustomTools(companyId) {
    const sql = `SELECT * FROM custom_tools WHERE company_id = ? AND status = 'active'`;
    const tools = await this.query(sql, [companyId]);
    return tools.map(tool => ({
      ...tool,
      configuration: JSON.parse(tool.configuration)
    }));
  }

  async updateCustomTool(toolId, updates) {
    if (updates.configuration) {
      updates.configuration = JSON.stringify(updates.configuration);
    }
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), toolId];
    const sql = `UPDATE custom_tools SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, values);
  }

  async deleteCustomTool(toolId) {
    const sql = `UPDATE custom_tools SET status = 'inactive' WHERE id = ?`;
    return await this.execute(sql, [toolId]);
  }

  // ==================== WORKFLOW OPERATIONS ====================

  async createWorkflow(id, companyId, name, description, triggerType, triggerValue, steps) {
    const sql = `
      INSERT INTO workflows (id, company_id, name, description, trigger_type, trigger_value, steps)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [id, companyId, name, description, triggerType, triggerValue, JSON.stringify(steps)]);
  }

  async getWorkflows(companyId) {
    const sql = `SELECT * FROM workflows WHERE company_id = ? AND status = 'active'`;
    const workflows = await this.query(sql, [companyId]);
    return workflows.map(workflow => ({
      ...workflow,
      steps: JSON.parse(workflow.steps)
    }));
  }

  async updateWorkflow(workflowId, updates) {
    if (updates.steps) {
      updates.steps = JSON.stringify(updates.steps);
    }
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), workflowId];
    const sql = `UPDATE workflows SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, values);
  }

  async deleteWorkflow(workflowId) {
    const sql = `UPDATE workflows SET status = 'inactive' WHERE id = ?`;
    return await this.execute(sql, [workflowId]);
  }

  // ==================== AGENT STATUS OPERATIONS ====================

  async createOrUpdateAgentStatus(id, agentId, companyId, status, currentLoad, maxLoad) {
    const sql = `
      INSERT INTO agent_status (id, agent_id, company_id, status, current_load, max_load, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(agent_id) DO UPDATE SET 
        status = ?, current_load = ?, max_load = ?, last_updated = CURRENT_TIMESTAMP
    `;
    return await this.execute(sql, [id, agentId, companyId, status, currentLoad, maxLoad, status, currentLoad, maxLoad]);
  }

  async getAgentStatus(agentId) {
    const sql = `SELECT * FROM agent_status WHERE agent_id = ?`;
    return await this.queryOne(sql, [agentId]);
  }

  async getOnlineAgents(companyId) {
    const sql = `SELECT * FROM agent_status WHERE company_id = ? AND status = 'online'`;
    return await this.query(sql, [companyId]);
  }

  // ==================== APPROVAL REQUEST OPERATIONS ====================

  async createApprovalRequest(id, companyId, customerId, conversationId, summary, customerMessage, conversationHistory, proposedAction, priority, urgency) {
    const sql = `
      INSERT INTO approval_requests 
      (id, company_id, customer_id, conversation_id, summary, customer_message, 
       conversation_history, proposed_action, priority, urgency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [
      id, companyId, customerId, conversationId, summary, customerMessage, 
      JSON.stringify(conversationHistory), proposedAction, priority, urgency
    ]);
  }

  async getApprovalRequests(companyId, status = 'pending') {
    const sql = `
      SELECT * FROM approval_requests 
      WHERE company_id = ? AND status = ?
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        created_at ASC
    `;
    const requests = await this.query(sql, [companyId, status]);
    return requests.map(request => ({
      ...request,
      conversation_history: JSON.parse(request.conversation_history)
    }));
  }

  async assignApprovalRequest(requestId, agentId) {
    const sql = `UPDATE approval_requests SET agent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, [agentId, requestId]);
  }

  async updateApprovalRequest(requestId, updates) {
    if (updates.conversation_history) {
      updates.conversation_history = JSON.stringify(updates.conversation_history);
    }
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), requestId];
    const sql = `UPDATE approval_requests SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, values);
  }

  // ==================== CONVERSATION OPERATIONS ====================

  async createConversation(id, companyId, customerId, sessionId, messages) {
    const sql = `
      INSERT INTO conversations (id, company_id, customer_id, session_id, messages)
      VALUES (?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [id, companyId, customerId, sessionId, JSON.stringify(messages)]);
  }

  async getConversation(conversationId) {
    const sql = `SELECT * FROM conversations WHERE id = ?`;
    const conversation = await this.queryOne(sql, [conversationId]);
    if (conversation) {
      conversation.messages = JSON.parse(conversation.messages);
    }
    return conversation;
  }

  async updateConversation(conversationId, updates) {
    if (updates.messages) {
      updates.messages = JSON.stringify(updates.messages);
    }
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), conversationId];
    const sql = `UPDATE conversations SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.execute(sql, values);
  }

  async getConversationsByCustomer(customerId, companyId) {
    const sql = `SELECT * FROM conversations WHERE customer_id = ? AND company_id = ? ORDER BY created_at DESC`;
    const conversations = await this.query(sql, [customerId, companyId]);
    return conversations.map(conv => ({
      ...conv,
      messages: JSON.parse(conv.messages)
    }));
  }

  // ==================== PERFORMANCE METRICS OPERATIONS ====================

  async createOrUpdatePerformanceMetrics(id, agentId, companyId, date, metrics) {
    const sql = `
      INSERT INTO performance_metrics 
      (id, agent_id, company_id, date, total_conversations, total_approvals_handled, 
       total_escalations, avg_response_time_seconds, avg_resolution_time_seconds, 
       customer_satisfaction_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id, date) DO UPDATE SET 
        total_conversations = ?, total_approvals_handled = ?, total_escalations = ?,
        avg_response_time_seconds = ?, avg_resolution_time_seconds = ?, 
        customer_satisfaction_score = ?
    `;
    return await this.execute(sql, [
      id, agentId, companyId, date, metrics.totalConversations, metrics.totalApprovalsHandled,
      metrics.totalEscalations, metrics.avgResponseTimeSeconds, metrics.avgResolutionTimeSeconds,
      metrics.customerSatisfactionScore,
      metrics.totalConversations, metrics.totalApprovalsHandled, metrics.totalEscalations,
      metrics.avgResponseTimeSeconds, metrics.avgResolutionTimeSeconds, metrics.customerSatisfactionScore
    ]);
  }

  async getPerformanceMetrics(agentId, startDate, endDate) {
    const sql = `
      SELECT * FROM performance_metrics 
      WHERE agent_id = ? AND date BETWEEN ? AND ?
      ORDER BY date DESC
    `;
    return await this.query(sql, [agentId, startDate, endDate]);
  }

  async getCompanyPerformanceMetrics(companyId, startDate, endDate) {
    const sql = `
      SELECT * FROM performance_metrics 
      WHERE company_id = ? AND date BETWEEN ? AND ?
      ORDER BY date DESC
    `;
    return await this.query(sql, [companyId, startDate, endDate]);
  }

  // ==================== FEEDBACK OPERATIONS ====================

  async createFeedback(id, companyId, conversationId, customerId, rating, comment) {
    const sql = `
      INSERT INTO feedback (id, company_id, conversation_id, customer_id, rating, comment)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    return await this.execute(sql, [id, companyId, conversationId, customerId, rating, comment]);
  }

  async getFeedbackByConversation(conversationId) {
    const sql = `SELECT * FROM feedback WHERE conversation_id = ?`;
    return await this.queryOne(sql, [conversationId]);
  }

  async getFeedbackByCompany(companyId, startDate = null, endDate = null) {
    let sql = `SELECT * FROM feedback WHERE company_id = ?`;
    const params = [companyId];
    
    if (startDate && endDate) {
      sql += ` AND created_at BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    
    sql += ` ORDER BY created_at DESC`;
    return await this.query(sql, params);
  }
}
