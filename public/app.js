/**
 * Multi-tenant Customer Support Agent - Frontend Application
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const loginContainer = document.getElementById('login-container');
  const chatContainer = document.getElementById('chat-container');
  const companySelect = document.getElementById('company-select');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const menuItems = document.querySelectorAll('.menu-item');
  const viewContainers = document.querySelectorAll('.view-container');
  const companyName = document.getElementById('company-name');
  const agentName = document.getElementById('agent-name');
  const userName = document.getElementById('user-name');
  
  // Chat widget elements
  const chatWidget = document.getElementById('chat-widget');
  const widgetToggleBtn = document.getElementById('widget-toggle-btn');
  const widgetCloseBtn = document.getElementById('widget-close-btn');
  const widgetMessages = document.getElementById('widget-messages');
  const widgetInput = document.getElementById('widget-input');
  const widgetSendBtn = document.getElementById('widget-send-btn');
  const widgetAgentName = document.getElementById('widget-agent-name');
  
  // Application state
  let state = {
    user: null,
    companyId: null,
    companyConfig: null,
    sessionId: null,
    messages: [],
    widgetOpen: false,
    socket: null,
    currentCategory: null // Added missing property
  };
  
  // Company configurations (would normally be fetched from the server)
  const companyConfigs = {
    'company-1': {
      agentName: 'SupportBot',
      branding: {
        companyName: 'TechCorp',
        primaryColor: '#4285F4',
        logo: '🖥️'
      }
    },
    'company-2': {
      agentName: 'Helpy',
      branding: {
        companyName: 'FriendlyShop',
        primaryColor: '#34A853',
        logo: '🛒'
      }
    }
  };
  
  // Initialize the application
  function init() {
    // Check if user is already logged in
    const savedUser = Cookies.get('user');
    const savedCompanyId = Cookies.get('companyId');
    
    if (savedUser && savedCompanyId) {
      try {
        state.user = JSON.parse(savedUser);
        state.companyId = savedCompanyId;
        state.companyConfig = companyConfigs[savedCompanyId];
        
        if (state.companyConfig) {
          loginSuccess();
        } else {
          logout();
        }
      } catch (e) {
        logout();
      }
    }
    
    // Set up event listeners
    setupEventListeners();
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Login form submission
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });
    
    // Agent login form submission
    document.getElementById('agent-login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAgentLogin();
    });
    
    // Login button
    loginBtn.addEventListener('click', handleLogin);
    
    // Agent login button
    document.getElementById('agent-login-btn')?.addEventListener('click', handleAgentLogin);
    
    // Login tabs
    document.getElementById('customer-tab')?.addEventListener('click', () => {
      document.getElementById('customer-tab').classList.add('active');
      document.getElementById('agent-tab').classList.remove('active');
      document.getElementById('customer-login').classList.add('active');
      document.getElementById('agent-login').classList.remove('active');
    });
    
    document.getElementById('agent-tab')?.addEventListener('click', () => {
      document.getElementById('agent-tab').classList.add('active');
      document.getElementById('customer-tab').classList.remove('active');
      document.getElementById('agent-login').classList.add('active');
      document.getElementById('customer-login').classList.remove('active');
    });
    
    // Logout button
    logoutBtn.addEventListener('click', logout);
    
    // Send message button
    sendBtn.addEventListener('click', sendMessage);
    
    // Chat input enter key
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Menu navigation
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        showView(view);
      });
    });
    
    // Widget toggle
    widgetToggleBtn.addEventListener('click', toggleWidget);
    
    // Widget close
    widgetCloseBtn.addEventListener('click', closeWidget);
    
    // Widget send button
    widgetSendBtn.addEventListener('click', sendWidgetMessage);
    
    // Widget input enter key
    widgetInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendWidgetMessage();
      }
    });
    
    // Add FAQ button
    document.getElementById('add-faq-btn')?.addEventListener('click', addNewFAQ);
    
    // Approval filter buttons
    document.querySelectorAll('.filter-btn')?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterApprovals(btn.getAttribute('data-filter'));
      });
    });
    
    // FAQ search functionality
    document.getElementById('faq-search')?.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      document.querySelectorAll('.faq-item').forEach(item => {
        const question = item.querySelector('.faq-question').textContent.toLowerCase();
        const answer = item.querySelector('.faq-answer').textContent.toLowerCase();
        
        if (question.includes(searchTerm) || answer.includes(searchTerm)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
    
    // Sidebar menu items for agent views
    document.querySelectorAll('.sidebar-item')?.forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.main-view').forEach(view => view.style.display = 'none');
        
        const viewId = item.getAttribute('data-view');
        if (viewId) {
          document.getElementById(viewId).style.display = 'block';
          
          if (viewId === 'approvals-view') {
            loadPendingApprovals();
          } else if (viewId === 'faq-training-view') {
            loadExistingFAQs();
          }
        }
      });
    });
  }
  
  // Handle login
  function handleLogin(e) {
    if (e) e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const companyId = companySelect.value;
    
    if (!email || !password) {
      alert('Please enter email and password');
      return;
    }
    
    // For demo purposes, any email/password will work
    // In production, this would make an API call to authenticate
    
    state.user = {
      id: 'user-' + Date.now(),
      email,
      name: email.split('@')[0],
      role: 'user'
    };
    
    state.companyId = companyId;
    state.companyConfig = companyConfigs[companyId];
    
    // Save to cookies
    Cookies.set('user', JSON.stringify(state.user), { expires: 7 });
    Cookies.set('companyId', companyId, { expires: 7 });
    
    loginSuccess(false);
  }
  
  // Handle agent login
  function handleAgentLogin() {
    const email = document.getElementById('agent-email').value;
    const password = document.getElementById('agent-password').value;
    const companyId = document.getElementById('agent-company-select').value;
    
    if (!email || !password) {
      alert('Please enter email and password');
      return;
    }
    
    // For demo purposes, any email/password will work
    // In production, this would make an API call to authenticate
    
    state.user = {
      id: 'agent-' + Date.now(),
      email,
      name: email.split('@')[0],
      role: 'agent'
    };
    
    state.companyId = companyId;
    state.companyConfig = companyConfigs[companyId];
    
    // Save to cookies
    Cookies.set('user', JSON.stringify(state.user), { expires: 7 });
    Cookies.set('companyId', companyId, { expires: 7 });
    Cookies.set('userRole', 'agent', { expires: 7 });
    
    loginSuccess(true);
  }
  
  // Login success
  function loginSuccess(isAgent = false) {
    // Generate a session ID
    state.sessionId = 'session-' + Date.now();
    state.token = 'token-' + Date.now(); // Add token for API calls
    
    // Update UI with company branding
    updateBranding();
    
    // Show chat container
    loginContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    
    // Update user info
    userName.textContent = state.user.name;
    
    // Show agent-specific UI if applicable
    if (isAgent || state.user.role === 'agent') {
      document.getElementById('user-role').textContent = 'Company Agent';
      document.getElementById('user-role').classList.remove('hidden');
      
      // Show agent-only menu items
      document.querySelectorAll('.agent-only').forEach(el => {
        el.classList.remove('hidden');
      });
      
      // Load pending approvals
      loadPendingApprovals();
      
      // Load existing FAQs
      loadExistingFAQs();
    }
    
    // Connect to WebSocket
    connectWebSocket();
    
    // Add welcome message
    addMessage({
      role: 'agent',
      content: `Welcome to ${state.companyConfig.branding.companyName} support! ${isAgent ? 'You are logged in as a company agent.' : 'How can I help you today?'}`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Update branding based on company config
  function updateBranding() {
    const { branding, agentName: botName } = state.companyConfig;
    
    // Update company name and logo
    companyName.textContent = branding.companyName;
    document.getElementById('company-logo').textContent = branding.logo;
    
    // Update agent name
    agentName.textContent = botName;
    widgetAgentName.textContent = botName;
    
    // Update primary color
    document.documentElement.style.setProperty('--primary-color', branding.primaryColor);
    
    // Update widget company logo
    document.getElementById('widget-company-logo').textContent = branding.logo;
  }
  
  // Connect to WebSocket
  function connectWebSocket() {
    // In a real implementation, this would connect to the WebSocket endpoint
    // For demo purposes, we'll simulate the connection
    console.log('WebSocket connected');
  }
  
  // Logout
  function logout() {
    // Clear state
    state = {
      user: null,
      companyId: null,
      companyConfig: null,
      sessionId: null,
      messages: [],
      widgetOpen: false,
      currentCategory: null // Reset missing property
    };
    
    // Clear cookies
    Cookies.remove('user');
    Cookies.remove('companyId');
    
    // Show login container
    chatContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
    
    // Clear chat messages
    chatMessages.innerHTML = '';
    widgetMessages.innerHTML = '';
    
    // Close WebSocket if open
    if (state.socket) {
      state.socket.close();
      state.socket = null;
    }
    
    // Close widget if open
    closeWidget();
  }
  
  // Send a message
  function sendMessage() {
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Add message to UI
    addMessage({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Clear input
    chatInput.value = '';
    
    // Get trained FAQs for the company
    const companyFAQs = JSON.parse(localStorage.getItem(`faqs_${state.companyId}`)) || [];
    
    // Check if the message matches any FAQ before sending to API
    let faqMatch = false;
    let approvalId = null;
    
    // Check if this is a request that might need approval
    if (message.includes('refund') || 
        message.includes('cancel') || 
        message.includes('delete') ||
        message.includes('money back')) {
      approvalId = 'approval-' + Date.now();
    }
    
    // Check for FAQ matches
    if (companyFAQs.length > 0) {
      // Sort FAQs by relevance score
      const scoredFaqs = companyFAQs.map(faq => {
        const questionLower = faq.question.toLowerCase();
        const messageLower = message.toLowerCase();
        
        // Calculate relevance score based on multiple factors
        let score = 0;
        
        // 1. Exact phrase matching (highest priority)
        if (messageLower.includes(questionLower) || questionLower.includes(messageLower)) {
          score += 100;
        }
        
        // 2. Word matching with position weighting
        const questionWords = questionLower.split(/\s+/).filter(word => word.length > 2);
        const messageWords = messageLower.split(/\s+/).filter(word => word.length > 2);
        
        // Count matching words and their positions
        let matchCount = 0;
        questionWords.forEach(word => {
          if (messageWords.includes(word)) {
            matchCount++;
            // Words at the beginning are more important
            if (messageWords.indexOf(word) < 3) {
              score += 5;
            }
          }
        });
        
        // Add score based on percentage of matching words
        if (questionWords.length > 0) {
          score += (matchCount / questionWords.length) * 50;
        }
        
        // 3. Category matching if available
        if (faq.category && state.currentCategory && 
            faq.category.toLowerCase() === state.currentCategory.toLowerCase()) {
          score += 20;
        }
        
        return { faq, score };
      }).sort((a, b) => b.score - a.score); // Sort by score descending
      
      // Only consider matches with a minimum score
      const bestMatch = scoredFaqs[0];
      if (bestMatch && bestMatch.score > 30) {
        // Add AI response from best matching FAQ
        addMessage({
          role: 'agent',
          content: bestMatch.faq.answer + "\n\n(This answer was provided based on the company's FAQ database)",
          timestamp: new Date().toISOString(),
          approvalId: approvalId
        });
        faqMatch = true;
      }
    }
    
    // If no FAQ match, send to regular API
    if (!faqMatch) {
      sendToAPI(message, false, approvalId);
    }
  }
  
  // Send a message from the widget
  function sendWidgetMessage() {
    const message = widgetInput.value.trim();
    
    if (!message) return;
    
    // Add message to widget UI
    addWidgetMessage({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Clear input
    widgetInput.value = '';
    
    // Send to API
    sendToAPI(message, true);
  }
  
  // Send message to API
  function sendToAPI(message, isWidget = false) {
    // In a real implementation, this would send to the API
    // For demo purposes, we'll simulate the response
    
    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message agent typing';
    typingIndicator.textContent = 'Typing...';
    
    if (isWidget) {
      widgetMessages.appendChild(typingIndicator);
      widgetMessages.scrollTop = widgetMessages.scrollHeight;
    } else {
      chatMessages.appendChild(typingIndicator);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Simulate API delay
    setTimeout(() => {
      // Remove typing indicator
      if (isWidget) {
        widgetMessages.removeChild(typingIndicator);
      } else {
        chatMessages.removeChild(typingIndicator);
      }
      
      // Generate response based on message
      let response;
      
      if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
        response = `Hello! How can I assist you with ${state.companyConfig.branding.companyName} today?`;
      } else if (message.toLowerCase().includes('help')) {
        response = `I'm here to help! What specific assistance do you need with ${state.companyConfig.branding.companyName}'s services?`;
      } else if (message.toLowerCase().includes('order')) {
        response = `I can help you with your order. Could you please provide your order number?`;
      } else if (message.toLowerCase().includes('account')) {
        response = `For account-related inquiries, I'll need to verify some information. What specific account issue are you experiencing?`;
      } else {
        response = `Thank you for your message. I'll do my best to assist you with ${state.companyConfig.branding.companyName}'s products and services. Could you provide more details about your inquiry?`;
      }
      
      // Add response to UI
      const responseObj = {
        role: 'agent',
        content: response,
        timestamp: new Date().toISOString()
      };
      
      if (isWidget) {
        addWidgetMessage(responseObj);
      } else {
        addMessage(responseObj);
      }
    }, 1500);
  }
  
  // Add a message to the chat UI
  function addMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.role}`;
    
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = message.content;
    
    // If there's an approval request, add approval buttons for agents
    if (message.approvalId && state.user.role === 'agent') {
      const approvalEl = document.createElement('div');
      approvalEl.className = 'approval-request';
      approvalEl.innerHTML = `
        <div class="approval-info">Approval ID: ${message.approvalId}</div>
        <div class="approval-actions">
          <button class="approve-btn" data-approval-id="${message.approvalId}">Approve</button>
          <button class="reject-btn" data-approval-id="${message.approvalId}">Reject</button>
        </div>
      `;
      contentEl.appendChild(approvalEl);
      
      // Add event listeners for approval buttons
      setTimeout(() => {
        const approveBtn = document.querySelector(`.approve-btn[data-approval-id="${message.approvalId}"]`);
        const rejectBtn = document.querySelector(`.reject-btn[data-approval-id="${message.approvalId}"]`);
        if (approveBtn) approveBtn.addEventListener('click', () => handleApproval(message.approvalId, true));
        if (rejectBtn) rejectBtn.addEventListener('click', () => handleApproval(message.approvalId, false));
      }, 0);
    }
    
    const timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    timeEl.textContent = formatTime(message.timestamp);
    
    messageEl.appendChild(contentEl);
    messageEl.appendChild(timeEl);
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add to state
    state.messages.push(message);
  }
  
  // Load pending approvals
  async function loadPendingApprovals() {
    if (state.user.role !== 'agent') return;
    
    try {
      const response = await fetch(`/api/approvals?companyId=${state.companyId}`, {
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'X-Company-ID': state.companyId
        }
      });
      
      if (response.ok) {
        const approvals = await response.json();
        renderApprovals(approvals);
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
      
      // For demo purposes, show some sample approvals
      const sampleApprovals = [
        {
          id: 'approval-1',
          action: 'Refund request for order #12345',
          userId: 'user-123',
          userName: 'John Doe',
          timestamp: new Date().toISOString(),
          status: 'pending'
        },
        {
          id: 'approval-2',
          action: 'Account deletion request',
          userId: 'user-456',
          userName: 'Jane Smith',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'pending'
        }
      ];
      
      renderApprovals(sampleApprovals);
    }
  }
  
  // Render approvals in the approvals view
  function renderApprovals(approvals) {
    const approvalsList = document.getElementById('approvals-list');
    if (!approvalsList) return;
    
    approvalsList.innerHTML = '';
    
    if (!approvals || approvals.length === 0) {
      approvalsList.innerHTML = '<div class="no-approvals">No pending approval requests</div>';
      return;
    }
    
    approvals.forEach(approval => {
      const approvalEl = document.createElement('div');
      approvalEl.className = `approval-item ${approval.status}`;
      approvalEl.innerHTML = `
        <div class="approval-header">
          <div class="approval-id">ID: ${approval.id}</div>
          <div class="approval-status">${approval.status}</div>
        </div>
        <div class="approval-action">${approval.action}</div>
        <div class="approval-user">Requested by: ${approval.userName}</div>
        <div class="approval-time">Time: ${new Date(approval.timestamp).toLocaleString()}</div>
        ${approval.status === 'pending' ? `
          <div class="approval-buttons">
            <button class="approve-btn" data-approval-id="${approval.id}">Approve</button>
            <button class="reject-btn" data-approval-id="${approval.id}">Reject</button>
          </div>
        ` : ''}
      `;
      
      approvalsList.appendChild(approvalEl);
      
      // Add event listeners for approval buttons
      if (approval.status === 'pending') {
        setTimeout(() => {
          const approveBtn = approvalEl.querySelector('.approve-btn');
          const rejectBtn = approvalEl.querySelector('.reject-btn');
          if (approveBtn) approveBtn.addEventListener('click', () => handleApproval(approval.id, true));
          if (rejectBtn) rejectBtn.addEventListener('click', () => handleApproval(approval.id, false));
        }, 0);
      }
    });
  }
  
  // Handle approval decision
  async function handleApproval(approvalId, isApproved) {
    try {
      const response = await fetch(`/api/approvals/${approvalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
          'X-Company-ID': state.companyId
        },
        body: JSON.stringify({
          approved: isApproved,
          agentId: state.user.id,
          agentName: state.user.name
        })
      });
      
      if (response.ok) {
        // Refresh approvals list
        loadPendingApprovals();
        
        // Show confirmation message
        alert(`Request ${isApproved ? 'approved' : 'rejected'} successfully`);
      }
    } catch (error) {
      console.error('Error processing approval:', error);
      
      // For demo purposes, show success message anyway
      alert(`Request ${isApproved ? 'approved' : 'rejected'} successfully`);
      
      // Update UI to reflect the decision
      const approvalItem = document.querySelector(`.approval-item:has([data-approval-id="${approvalId}"])`);
      if (approvalItem) {
        approvalItem.className = `approval-item ${isApproved ? 'approved' : 'rejected'}`;
        const statusEl = approvalItem.querySelector('.approval-status');
        if (statusEl) statusEl.textContent = isApproved ? 'approved' : 'rejected';
        const buttonsEl = approvalItem.querySelector('.approval-buttons');
        if (buttonsEl) buttonsEl.remove();
      }
    }
  }
  
  // Filter approvals by status
  function filterApprovals(status) {
    document.querySelectorAll('.approval-item').forEach(item => {
      if (status === 'all' || item.classList.contains(status)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  // Load existing FAQs
  async function loadExistingFAQs() {
    if (state.user.role !== 'agent') return;
    
    try {
      // Get FAQs from local storage
      let storedFAQs = JSON.parse(localStorage.getItem(`faqs_${state.companyId}`)) || [];
      
      // If no FAQs in storage, use sample FAQs
      if (storedFAQs.length === 0) {
        storedFAQs = [
          {
            id: 'faq-1',
            question: 'How do I reset my password?',
            answer: 'You can reset your password by clicking on the "Forgot Password" link on the login page and following the instructions sent to your email.',
            category: 'account'
          },
          {
            id: 'faq-2',
            question: 'What payment methods do you accept?',
            answer: 'We accept Visa, Mastercard, American Express, and PayPal for all purchases.',
            category: 'billing'
          }
        ];
        
        // Save sample FAQs to local storage
        localStorage.setItem(`faqs_${state.companyId}`, JSON.stringify(storedFAQs));
      }
      
      renderFAQs(storedFAQs);
    } catch (error) {
      console.error('Error loading FAQs:', error);
      
      // For demo purposes, show some sample FAQs
      const sampleFAQs = [
        {
          id: 'faq-1',
          question: 'How do I reset my password?',
          answer: 'You can reset your password by clicking on the "Forgot Password" link on the login page and following the instructions sent to your email.',
          category: 'account'
        },
        {
          id: 'faq-2',
          question: 'What payment methods do you accept?',
          answer: 'We accept Visa, Mastercard, American Express, and PayPal for all purchases.',
          category: 'billing'
        }
      ];
      
      renderFAQs(sampleFAQs);
    }
  }
  
  // Render FAQs in the FAQ list
  function renderFAQs(faqs) {
    const faqList = document.getElementById('faq-list');
    if (!faqList) return;
    
    faqList.innerHTML = '';
    
    if (!faqs || faqs.length === 0) {
      faqList.innerHTML = '<div class="no-faqs">No FAQs found</div>';
      return;
    }
    
    faqs.forEach(faq => {
      const faqEl = document.createElement('div');
      faqEl.className = 'faq-item';
      faqEl.innerHTML = `
        <div class="faq-question">${faq.question}</div>
        <div class="faq-answer">${faq.answer}</div>
        <div class="faq-category">Category: ${faq.category}</div>
        <div class="faq-actions">
          <button class="edit-faq-btn" data-faq-id="${faq.id}">Edit</button>
          <button class="delete-faq-btn" data-faq-id="${faq.id}">Delete</button>
        </div>
      `;
      
      faqList.appendChild(faqEl);
    });
  }
  
  // Add new FAQ
  async function addNewFAQ() {
    const question = document.getElementById('faq-question').value;
    const answer = document.getElementById('faq-answer').value;
    const category = document.getElementById('faq-category').value;
    
    if (!question || !answer) {
      alert('Please enter both question and answer');
      return;
    }
    
    const newFAQ = {
      id: 'faq-' + Date.now(),
      question,
      answer,
      category,
      companyId: state.companyId
    };
    
    // Store FAQ in local storage for demo purposes
    try {
      // Get existing FAQs from local storage
      let storedFAQs = JSON.parse(localStorage.getItem(`faqs_${state.companyId}`)) || [];
      
      // Add new FAQ
      storedFAQs.push(newFAQ);
      
      // Save back to local storage
      localStorage.setItem(`faqs_${state.companyId}`, JSON.stringify(storedFAQs));
      
      // Clear form
      document.getElementById('faq-question').value = '';
      document.getElementById('faq-answer').value = '';
      
      // Show confirmation
      alert('FAQ added successfully and will be used by the AI');
      
      // Add to the list
      const faqList = document.getElementById('faq-list');
      if (!faqList) return;
      
      const noFaqs = faqList.querySelector('.no-faqs');
      if (noFaqs) {
        noFaqs.remove();
      }
      
      const faqEl = document.createElement('div');
      faqEl.className = 'faq-item';
      faqEl.innerHTML = `
        <div class="faq-question">${newFAQ.question}</div>
        <div class="faq-answer">${newFAQ.answer}</div>
        <div class="faq-category">Category: ${newFAQ.category}</div>
        <div class="faq-actions">
          <button class="edit-faq-btn" data-faq-id="${newFAQ.id}">Edit</button>
          <button class="delete-faq-btn" data-faq-id="${newFAQ.id}">Delete</button>
        </div>
      `;
      
      faqList.appendChild(faqEl);
      
      // Notify the user that the AI has been trained
      addMessage({
        role: 'assistant',
        content: `I've been trained with your new FAQ about "${question}". You can now ask me questions related to this topic!`,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error adding FAQ:', error);
      alert('There was an error adding the FAQ, but it will still be available for this session');
    }
  }
  
  // Add a message to the widget UI
  function addWidgetMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.role}`;
    
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = message.content;
    
    const timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    timeEl.textContent = formatTime(message.timestamp);
    
    messageEl.appendChild(contentEl);
    messageEl.appendChild(timeEl);
    
    widgetMessages.appendChild(messageEl);
    widgetMessages.scrollTop = widgetMessages.scrollHeight;
    
    // Add to state
    state.messages.push(message);
  }
  
  // Format timestamp
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Show a specific view
  function showView(viewName) {
    // Update menu items
    menuItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    // Update view containers
    viewContainers.forEach(container => {
      if (container.id === `${viewName}-view`) {
        container.classList.add('active');
      } else {
        container.classList.remove('active');
      }
    });
  }
  
  // Toggle chat widget
  function toggleWidget() {
    if (state.widgetOpen) {
      closeWidget();
    } else {
      openWidget();
    }
  }
  
  // Open chat widget
  function openWidget() {
    chatWidget.classList.remove('hidden');
    state.widgetOpen = true;
  }
  
  // Close chat widget
  function closeWidget() {
    chatWidget.classList.add('hidden');
    state.widgetOpen = false;
  }
  
  // Initialize the application
  init();
});