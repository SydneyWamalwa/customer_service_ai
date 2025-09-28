/**
 * Human escalation feature for the multi-tenant customer support agent
 * Handles routing complex queries to human agents
 */

/**
 * Manages escalation to human agents
 */
class EscalationManager {
  /**
   * Creates a new EscalationManager instance
   * @param {object} companyConfig - Company configuration
   */
  constructor(companyConfig) {
    this.companyConfig = companyConfig;
    this.escalatedSessions = new Map(); // Map of sessionId to escalation status
  }
  
  /**
   * Determines if a query should be escalated based on complexity or keywords
   * @param {string} query - The user query
   * @param {object} context - Additional context (session history, etc.)
   * @returns {boolean} - Whether the query should be escalated
   */
  shouldEscalate(query, context) {
    // Check for explicit escalation requests
    const escalationKeywords = [
      'speak to human', 'talk to agent', 'speak to agent', 'human agent',
      'real person', 'customer service', 'supervisor', 'manager'
    ];
    
    const hasEscalationKeyword = escalationKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (hasEscalationKeyword) {
      return true;
    }
    
    // Check for complex queries based on length and structure
    if (query.length > 200) {
      return true;
    }
    
    // Check for multiple questions in one query
    const questionMarks = (query.match(/\?/g) || []).length;
    if (questionMarks >= 3) {
      return true;
    }
    
    // Check for repeated failed attempts
    if (context && context.sessionHistory) {
      const recentMessages = context.sessionHistory.slice(-6);
      const userMessages = recentMessages.filter(msg => msg.role === 'user');
      
      // Check for user expressing frustration
      const frustrationKeywords = ['not working', 'doesn\'t work', 'wrong', 'incorrect', 'frustrated', 'annoyed'];
      const hasFrustration = frustrationKeywords.some(keyword => 
        userMessages.some(msg => msg.content.toLowerCase().includes(keyword.toLowerCase()))
      );
      
      if (hasFrustration && userMessages.length >= 3) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Escalates a session to a human agent
   * @param {string} sessionId - The session ID
   * @param {object} userData - User data (name, email, etc.)
   * @param {string} query - The user query
   * @param {object} context - Session context and history
   * @returns {Promise<object>} - Escalation status and details
   */
  async escalateToHuman(sessionId, userData, query, context) {
    // Check if already escalated
    if (this.escalatedSessions.has(sessionId)) {
      return this.escalatedSessions.get(sessionId);
    }
    
    // Get company-specific escalation settings
    const escalationConfig = this.companyConfig.escalation || {
      method: 'dashboard', // default method
      notificationEmail: null,
      slackWebhook: null
    };
    
    // Create escalation record
    const escalationRecord = {
      sessionId,
      userId: userData.id,
      userName: userData.name,
      userEmail: userData.email,
      query,
      timestamp: new Date().toISOString(),
      status: 'pending',
      assignedAgent: null,
      estimatedWaitTime: '5-10 minutes',
      method: escalationConfig.method
    };
    
    // Route based on company configuration
    try {
      switch (escalationConfig.method) {
        case 'email':
          if (escalationConfig.notificationEmail) {
            // In a real implementation, this would send an email
            console.log(`Escalation email sent to ${escalationConfig.notificationEmail} for session ${sessionId}`);
            escalationRecord.status = 'notified';
          }
          break;
          
        case 'slack':
          if (escalationConfig.slackWebhook) {
            // In a real implementation, this would post to Slack
            console.log(`Escalation notification sent to Slack for session ${sessionId}`);
            escalationRecord.status = 'notified';
          }
          break;
          
        case 'dashboard':
        default:
          // Add to dashboard queue
          console.log(`Session ${sessionId} added to support dashboard queue`);
          escalationRecord.status = 'queued';
          break;
      }
      
      // Store escalation record
      this.escalatedSessions.set(sessionId, escalationRecord);
      
      return escalationRecord;
    } catch (error) {
      console.error('Escalation error:', error);
      
      // Return error status
      escalationRecord.status = 'error';
      escalationRecord.error = error.message;
      
      this.escalatedSessions.set(sessionId, escalationRecord);
      
      return escalationRecord;
    }
  }
  
  /**
   * Checks the status of an escalated session
   * @param {string} sessionId - The session ID
   * @returns {object|null} - Escalation status or null if not escalated
   */
  getEscalationStatus(sessionId) {
    return this.escalatedSessions.get(sessionId) || null;
  }
  
  /**
   * Updates the status of an escalated session
   * @param {string} sessionId - The session ID
   * @param {object} updates - Status updates
   * @returns {object|null} - Updated escalation record or null if not found
   */
  updateEscalationStatus(sessionId, updates) {
    if (!this.escalatedSessions.has(sessionId)) {
      return null;
    }
    
    const record = this.escalatedSessions.get(sessionId);
    const updatedRecord = { ...record, ...updates };
    
    this.escalatedSessions.set(sessionId, updatedRecord);
    
    return updatedRecord;
  }
  
  /**
   * Resolves an escalated session
   * @param {string} sessionId - The session ID
   * @param {string} resolution - Resolution notes
   * @returns {object|null} - Resolved escalation record or null if not found
   */
  resolveEscalation(sessionId, resolution) {
    if (!this.escalatedSessions.has(sessionId)) {
      return null;
    }
    
    const record = this.escalatedSessions.get(sessionId);
    const resolvedRecord = {
      ...record,
      status: 'resolved',
      resolution,
      resolvedAt: new Date().toISOString()
    };
    
    this.escalatedSessions.set(sessionId, resolvedRecord);
    
    return resolvedRecord;
  }
}

module.exports = {
  EscalationManager
};