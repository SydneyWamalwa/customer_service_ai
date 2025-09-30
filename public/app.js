/**
 * Multi-tenant Customer Support Agent - Frontend Application
 * Fixed version with robust error handling and CORS support
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements with null checks
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
    currentCategory: null,
    token: null
  };
  
  // Company configurations
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

  // API Configuration
  const API_CONFIG = {
  BASE_URL: 'https://cloudflare-ai-support-agent.sydneywamalwa.workers.dev/api/chat',
  FALLBACK_URL: 'http://localhost:8787',
  TIMEOUT: 30000, // Changed from 10000 to 30000 (30 seconds)
  RETRY_ATTEMPTS: 1 // Changed from 2 to 1
};
  
  // Initialize the application
  function init() {
    console.log('Initializing application...');
    
    // Check if user is already logged in
    const savedUser = getCookie('user');
    const savedCompanyId = getCookie('companyId');
    
    if (savedUser && savedCompanyId) {
      try {
        state.user = JSON.parse(savedUser);
        state.companyId = savedCompanyId;
        state.companyConfig = companyConfigs[savedCompanyId];
        
        if (state.companyConfig) {
          loginSuccess();
        } else {
          console.warn('Company config not found, logging out');
          logout();
        }
      } catch (e) {
        console.error('Error parsing saved user data:', e);
        logout();
      }
    }
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('Application initialized successfully');
  }
  
  // Cookie helper functions
  function setCookie(name, value, days = 7) {
    try {
      const expires = new Date();
      expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
      document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    } catch (e) {
      console.error('Error setting cookie:', e);
    }
  }
  
  function getCookie(name) {
    try {
      const nameEQ = name + "=";
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
      return null;
    } catch (e) {
      console.error('Error reading cookie:', e);
      return null;
    }
  }
  
  function removeCookie(name) {
    try {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    } catch (e) {
      console.error('Error removing cookie:', e);
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
      });
    }
    
    // Agent login form submission
    const agentLoginForm = document.getElementById('agent-login-form');
    if (agentLoginForm) {
      agentLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAgentLogin();
      });
    }
    
    // Login button
    if (loginBtn) {
      loginBtn.addEventListener('click', handleLogin);
    }
    
    // Agent login button
    const agentLoginBtn = document.getElementById('agent-login-btn');
    if (agentLoginBtn) {
      agentLoginBtn.addEventListener('click', handleAgentLogin);
    }
    
    // Login tabs
    const customerTab = document.getElementById('customer-tab');
    const agentTab = document.getElementById('agent-tab');
    const customerLogin = document.getElementById('customer-login');
    const agentLogin = document.getElementById('agent-login');
    
    if (customerTab && agentTab && customerLogin && agentLogin) {
      customerTab.addEventListener('click', () => {
        customerTab.classList.add('active');
        agentTab.classList.remove('active');
        customerLogin.classList.add('active');
        agentLogin.classList.remove('active');
      });
      
      agentTab.addEventListener('click', () => {
        agentTab.classList.add('active');
        customerTab.classList.remove('active');
        agentLogin.classList.add('active');
        customerLogin.classList.remove('active');
      });
    }
    
    // Logout button
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }
    
    // Send message button
    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }
    
    // Chat input enter key
    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
    
    // Menu navigation
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        if (view) showView(view);
      });
    });
    
    // Widget toggle
    if (widgetToggleBtn) {
      widgetToggleBtn.addEventListener('click', toggleWidget);
    }
    
    // Widget close
    if (widgetCloseBtn) {
      widgetCloseBtn.addEventListener('click', closeWidget);
    }
    
    // Widget send button
    if (widgetSendBtn) {
      widgetSendBtn.addEventListener('click', sendWidgetMessage);
    }
    
    // Widget input enter key
    if (widgetInput) {
      widgetInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendWidgetMessage();
        }
      });
    }
    
    // Add FAQ button
    const addFaqBtn = document.getElementById('add-faq-btn');
    if (addFaqBtn) {
      addFaqBtn.addEventListener('click', addNewFAQ);
    }
    
    // Approval filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        if (filter) filterApprovals(filter);
      });
    });
    
    // FAQ search functionality
    const faqSearch = document.getElementById('faq-search');
    if (faqSearch) {
      faqSearch.addEventListener('input', debounce((e) => {
        const searchTerm = e.target.value.toLowerCase();
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
          const questionEl = item.querySelector('.faq-question');
          const answerEl = item.querySelector('.faq-answer');
          
          if (questionEl && answerEl) {
            const question = questionEl.textContent.toLowerCase();
            const answer = answerEl.textContent.toLowerCase();
            
            if (question.includes(searchTerm) || answer.includes(searchTerm)) {
              item.style.display = 'block';
            } else {
              item.style.display = 'none';
            }
          }
        });
      }, 300));
    }
    
    // Sidebar menu items for agent views
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
      item.addEventListener('click', () => {
        const mainViews = document.querySelectorAll('.main-view');
        mainViews.forEach(view => view.style.display = 'none');
        
        const viewId = item.getAttribute('data-view');
        if (viewId) {
          const targetView = document.getElementById(viewId);
          if (targetView) {
            targetView.style.display = 'block';
            
            if (viewId === 'approvals-view') {
              loadPendingApprovals();
            } else if (viewId === 'faq-training-view') {
              loadExistingFAQs();
            }
          }
        }
      });
    });

    console.log('Event listeners setup completed');
  }
  
  // Handle login
  function handleLogin(e) {
    if (e) e.preventDefault();
    
    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');
    
    if (!emailEl || !passwordEl) {
      showError('Login form elements not found');
      return;
    }
    
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    const companyId = companySelect ? companySelect.value : 'company-1';
    
    if (!email || !password) {
      showError('Please enter email and password');
      return;
    }
    
    // For demo purposes, any email/password will work
    state.user = {
      id: 'user-' + Date.now(),
      email,
      name: email.split('@')[0],
      role: 'user'
    };
    
    state.companyId = companyId;
    state.companyConfig = companyConfigs[companyId];
    
    if (!state.companyConfig) {
      showError('Invalid company selected');
      return;
    }
    
    // Save to cookies
    setCookie('user', JSON.stringify(state.user), 7);
    setCookie('companyId', companyId, 7);
    
    loginSuccess(false);
  }
  
  // Handle agent login
  function handleAgentLogin() {
    const agentEmailEl = document.getElementById('agent-email');
    const agentPasswordEl = document.getElementById('agent-password');
    const agentCompanySelectEl = document.getElementById('agent-company-select');
    
    if (!agentEmailEl || !agentPasswordEl) {
      showError('Agent login form elements not found');
      return;
    }
    
    const email = agentEmailEl.value.trim();
    const password = agentPasswordEl.value;
    const companyId = agentCompanySelectEl ? agentCompanySelectEl.value : 'company-1';
    
    if (!email || !password) {
      showError('Please enter email and password');
      return;
    }
    
    // For demo purposes, any email/password will work
    state.user = {
      id: 'agent-' + Date.now(),
      email,
      name: email.split('@')[0],
      role: 'agent'
    };
    
    state.companyId = companyId;
    state.companyConfig = companyConfigs[companyId];
    
    if (!state.companyConfig) {
      showError('Invalid company selected');
      return;
    }
    
    // Save to cookies
    setCookie('user', JSON.stringify(state.user), 7);
    setCookie('companyId', companyId, 7);
    setCookie('userRole', 'agent', 7);
    
    loginSuccess(true);
  }
  
  // Login success
  function loginSuccess(isAgent = false) {
    console.log('Login successful, user role:', isAgent ? 'agent' : 'customer');
    
    // Generate a session ID and token
    state.sessionId = 'session-' + Date.now();
    state.token = 'token-' + Date.now();
    
    // Update UI with company branding
    updateBranding();
    
    // Show chat container
    if (loginContainer) loginContainer.classList.add('hidden');
    if (chatContainer) chatContainer.classList.remove('hidden');
    
    // Update user info
    if (userName) userName.textContent = state.user.name;
    
    // Show agent-specific UI if applicable
    if (isAgent || state.user.role === 'agent') {
      const userRoleEl = document.getElementById('user-role');
      if (userRoleEl) {
        userRoleEl.textContent = 'Company Agent';
        userRoleEl.classList.remove('hidden');
      }
      
      // Show agent-only menu items
      const agentOnlyEls = document.querySelectorAll('.agent-only');
      agentOnlyEls.forEach(el => {
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
    if (!state.companyConfig) return;
    
    const { branding, agentName: botName } = state.companyConfig;
    
    // Update company name and logo
    if (companyName) companyName.textContent = branding.companyName;
    
    const companyLogoEl = document.getElementById('company-logo');
    if (companyLogoEl) companyLogoEl.textContent = branding.logo;
    
    // Update agent name
    if (agentName) agentName.textContent = botName;
    if (widgetAgentName) widgetAgentName.textContent = botName;
    
    // Update primary color
    document.documentElement.style.setProperty('--primary-color', branding.primaryColor);
    
    // Update widget company logo
    const widgetCompanyLogoEl = document.getElementById('widget-company-logo');
    if (widgetCompanyLogoEl) widgetCompanyLogoEl.textContent = branding.logo;
  }
  
  // Connect to WebSocket
  function connectWebSocket() {
    // In a real implementation, this would connect to the WebSocket endpoint
    console.log('WebSocket connection simulated');
  }
  
  // Logout
  function logout() {
    console.log('Logging out user...');
    
    // Clear state
    state = {
      user: null,
      companyId: null,
      companyConfig: null,
      sessionId: null,
      messages: [],
      widgetOpen: false,
      socket: null,
      currentCategory: null,
      token: null
    };
    
    // Clear cookies
    removeCookie('user');
    removeCookie('companyId');
    removeCookie('userRole');
    
    // Show login container
    if (chatContainer) chatContainer.classList.add('hidden');
    if (loginContainer) loginContainer.classList.remove('hidden');
    
    // Clear chat messages
    if (chatMessages) chatMessages.innerHTML = '';
    if (widgetMessages) widgetMessages.innerHTML = '';
    
    // Close WebSocket if open
    if (state.socket) {
      state.socket.close();
      state.socket = null;
    }
    
    // Close widget if open
    closeWidget();
    
    console.log('Logout completed');
  }
  
  // Send a message
  function sendMessage() {
    if (!chatInput) {
      showError('Chat input not found');
      return;
    }
    
    const message = chatInput.value.trim();
    
    if (!message) {
      showError('Please enter a message');
      return;
    }
    
    // Add message to UI
    addMessage({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Clear input
    chatInput.value = '';
    
    // Process the message
    processUserMessage(message, false);
  }
  
  // Process user message with FAQ matching and API call
  async function processUserMessage(message, isWidget = false) {
    // Get trained FAQs for the company
    const companyFAQs = JSON.parse(localStorage.getItem(`faqs_${state.companyId}`)) || [];
    
    // Check if the message matches any FAQ before sending to API
    let faqMatch = false;
    let approvalId = null;
    
    // Check if this is a request that might need approval
    if (message.toLowerCase().includes('refund') || 
        message.toLowerCase().includes('cancel') || 
        message.toLowerCase().includes('delete') ||
        message.toLowerCase().includes('money back')) {
      approvalId = 'approval-' + Date.now();
    }
    
    // Check for FAQ matches
    if (companyFAQs.length > 0) {
      const bestMatch = findBestFAQMatch(message, companyFAQs);
      
      if (bestMatch && bestMatch.score > 30) {
        // Add AI response from best matching FAQ
        displayMessage(
          bestMatch.faq.answer + "\n\n(This answer was provided based on the company's FAQ database)",
          'agent', 
          isWidget, 
          approvalId
        );
        faqMatch = true;
      }
    }
    
    // If no FAQ match, send to regular API
    if (!faqMatch) {
      await sendToAPI(message, isWidget, approvalId);
    }
  }
  
  // Find best FAQ match for a message
  function findBestFAQMatch(message, faqs) {
    const messageLower = message.toLowerCase();
    
    const scoredFaqs = faqs.map(faq => {
      const questionLower = faq.question.toLowerCase();
      
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
    }).sort((a, b) => b.score - a.score);
    
    return scoredFaqs[0];
  }
  
  // Send a message from the widget
  function sendWidgetMessage() {
    if (!widgetInput) {
      showError('Widget input not found');
      return;
    }
    
    const message = widgetInput.value.trim();
    
    if (!message) {
      showError('Please enter a message');
      return;
    }
    
    // Add message to widget UI
    addWidgetMessage({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Clear input
    widgetInput.value = '';
    
    // Process the message
    processUserMessage(message, true);
  }
  
  // Send message to API with retry logic
  async function sendToAPI(message, isWidget = false, approvalId = null) {
    const targetContainer = isWidget ? widgetMessages : chatMessages;
    
    // Show typing indicator
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'message agent typing';
  typingIndicator.innerHTML = `
    <div class="typing-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
    
    if (targetContainer) {
      targetContainer.appendChild(typingIndicator);
      targetContainer.scrollTop = targetContainer.scrollHeight;
    }

    let lastError = null;
    
    for (let attempt = 0; attempt <= API_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} for API call`);
        }
        
        const response = await fetchWithTimeout(API_CONFIG.BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
            companyId: state.companyId || 'default',
            approvalId: approvalId,
            sessionId: state.sessionId
          })
        }, API_CONFIG.TIMEOUT);

        // Remove typing indicator
        if (targetContainer && targetContainer.contains(typingIndicator)) {
          targetContainer.removeChild(typingIndicator);
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();
        
        // Try to parse as JSON, fallback to text if it's HTML
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.warn('Response is not JSON, using as plain text:', responseText.substring(0, 100));
          
          // Check if it's HTML error page
          if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            throw new Error('Server returned HTML error page. The API might be down.');
          }
          
          data = { response: responseText };
        }
        
        // Display the AI response
        displayMessage(data.response || data.message || data.answer || 'I received your message but could not generate a proper response.', 'agent', isWidget, approvalId);
        return; // Success, exit retry loop
        
      } catch (error) {
        lastError = error;
        console.error(`API call attempt ${attempt + 1} failed:`, error);
        
        // If this was the last attempt, show error
        if (attempt === API_CONFIG.RETRY_ATTEMPTS) {
          // Remove typing indicator if still present
          if (targetContainer && targetContainer.contains(typingIndicator)) {
            targetContainer.removeChild(typingIndicator);
          }
          
          // Show error message to user
        const errorMessage = error.message.includes('timeout')
            ? "The AI is taking longer than expected to respond. This might be due to high server load. Please try again."
            : error.message.includes('HTML error page') 
            ? "I'm currently experiencing technical difficulties. Please try again later."
            : "Sorry, I'm having trouble connecting right now. Please try again.";
          
          displayMessage(errorMessage, 'agent', isWidget, approvalId);
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
  }
  
  // Fetch with timeout utility
  function fetchWithTimeout(url, options, timeout = 10000) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }
  
  // Display message helper function
  function displayMessage(content, role, isWidget = false, approvalId = null) {
    const messageObj = {
      role: role,
      content: content,
      timestamp: new Date().toISOString(),
      approvalId: approvalId
    };
    
    if (isWidget) {
      addWidgetMessage(messageObj);
    } else {
      addMessage(messageObj);
    }
  }
  
  // Add a message to the chat UI
  function addMessage(message) {
    if (!chatMessages) return;
    
    const messageEl = createMessageElement(message);
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add to state
    state.messages.push(message);
  }
  
  // Create message element with approval buttons if needed
  function createMessageElement(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.role}`;
    
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = message.content;
    
    // If there's an approval request, add approval buttons for agents
    if (message.approvalId && state.user && state.user.role === 'agent') {
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
    
    return messageEl;
  }
  
  // Load pending approvals
  async function loadPendingApprovals() {
    if (!state.user || state.user.role !== 'agent') return;
    
    try {
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
    } catch (error) {
      console.error('Error loading approvals:', error);
      showError('Failed to load approvals');
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
      // For demo purposes, simulate API call
      console.log(`Approval ${approvalId} ${isApproved ? 'approved' : 'rejected'}`);
      
      // Update UI to reflect the decision
      const approvalItems = document.querySelectorAll('.approval-item');
      approvalItems.forEach(item => {
        const approveBtn = item.querySelector(`[data-approval-id="${approvalId}"]`);
        if (approveBtn) {
          item.className = `approval-item ${isApproved ? 'approved' : 'rejected'}`;
          const statusEl = item.querySelector('.approval-status');
          if (statusEl) statusEl.textContent = isApproved ? 'approved' : 'rejected';
          const buttonsEl = item.querySelector('.approval-buttons');
          if (buttonsEl) buttonsEl.remove();
        }
      });
      
      showSuccess(`Request ${isApproved ? 'approved' : 'rejected'} successfully`);
      
    } catch (error) {
      console.error('Error processing approval:', error);
      showError('Failed to process approval');
    }
  }
  
  // Filter approvals by status
  function filterApprovals(status) {
    const approvalItems = document.querySelectorAll('.approval-item');
    approvalItems.forEach(item => {
      if (status === 'all' || item.classList.contains(status)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  // Load existing FAQs
  async function loadExistingFAQs() {
    if (!state.user || state.user.role !== 'agent') return;
    
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
      showError('Failed to load FAQs');
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
        <div class="faq-question">${escapeHtml(faq.question)}</div>
        <div class="faq-answer">${escapeHtml(faq.answer)}</div>
        <div class="faq-category">Category: ${escapeHtml(faq.category)}</div>
        <div class="faq-actions">
          <button class="edit-faq-btn" data-faq-id="${faq.id}">Edit</button>
          <button class="delete-faq-btn" data-faq-id="${faq.id}">Delete</button>
        </div>
      `;
      
      faqList.appendChild(faqEl);
      
      // Add event listeners for FAQ actions
      setTimeout(() => {
        const editBtn = faqEl.querySelector('.edit-faq-btn');
        const deleteBtn = faqEl.querySelector('.delete-faq-btn');
        if (editBtn) editBtn.addEventListener('click', () => editFAQ(faq.id));
        if (deleteBtn) deleteBtn.addEventListener('click', () => deleteFAQ(faq.id));
      }, 0);
    });
  }
  
  // Edit FAQ function
  function editFAQ(faqId) {
    const storedFAQs = JSON.parse(localStorage.getItem(`faqs_${state.companyId}`)) || [];
    const faq = storedFAQs.find(f => f.id === faqId);
    
    if (!faq) {
      showError('FAQ not found');
      return;
    }
    
    // Fill the form with existing data
    const questionEl = document.getElementById('faq-question');
    const answerEl = document.getElementById('faq-answer');
    const categoryEl = document.getElementById('faq-category');
    
    if (questionEl) questionEl.value = faq.question;
    if (answerEl) answerEl.value = faq.answer;
    if (categoryEl) categoryEl.value = faq.category;
    
    // Change the add button to update button temporarily
    const addBtn = document.getElementById('add-faq-btn');
    if (addBtn) {
      addBtn.textContent = 'Update FAQ';
      addBtn.onclick = () => updateFAQ(faqId);
    }
  }
  
  // Update FAQ function
  function updateFAQ(faqId) {
    const questionEl = document.getElementById('faq-question');
    const answerEl = document.getElementById('faq-answer');
    const categoryEl = document.getElementById('faq-category');
    
    if (!questionEl || !answerEl || !categoryEl) {
      showError('Form elements not found');
      return;
    }
    
    const question = questionEl.value.trim();
    const answer = answerEl.value.trim();
    const category = categoryEl.value.trim();
    
    if (!question || !answer) {
      showError('Please enter both question and answer');
      return;
    }
    
    try {
      const storedFAQs = JSON.parse(localStorage.getItem(`faqs_${state.companyId}`)) || [];
      const faqIndex = storedFAQs.findIndex(f => f.id === faqId);
      
      if (faqIndex === -1) {
        showError('FAQ not found');
        return;
      }
      
      // Update the FAQ
      storedFAQs[faqIndex] = {
        ...storedFAQs[faqIndex],
        question,
        answer,
        category
      };
      
      // Save to localStorage
      localStorage.setItem(`faqs_${state.companyId}`, JSON.stringify(storedFAQs));
      
      // Clear form
      questionEl.value = '';
      answerEl.value = '';
      categoryEl.value = 'general';
      
      // Reset button
      const addBtn = document.getElementById('add-faq-btn');
      if (addBtn) {
        addBtn.textContent = 'Add FAQ';
        addBtn.onclick = addNewFAQ;
      }
      
      // Refresh the FAQ list
      renderFAQs(storedFAQs);
      
      showSuccess('FAQ updated successfully');
      
    } catch (error) {
      console.error('Error updating FAQ:', error);
      showError('Error updating FAQ');
    }
  }
  
  // Delete FAQ function
  function deleteFAQ(faqId) {
    if (!confirm('Are you sure you want to delete this FAQ?')) {
      return;
    }
    
    try {
      const storedFAQs = JSON.parse(localStorage.getItem(`faqs_${state.companyId}`)) || [];
      const filteredFAQs = storedFAQs.filter(f => f.id !== faqId);
      
      localStorage.setItem(`faqs_${state.companyId}`, JSON.stringify(filteredFAQs));
      
      // Refresh the FAQ list
      renderFAQs(filteredFAQs);
      
      showSuccess('FAQ deleted successfully');
      
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      showError('Error deleting FAQ');
    }
  }
  
  // Add new FAQ
  async function addNewFAQ() {
    const questionEl = document.getElementById('faq-question');
    const answerEl = document.getElementById('faq-answer');
    const categoryEl = document.getElementById('faq-category');
    
    if (!questionEl || !answerEl || !categoryEl) {
      showError('Form elements not found');
      return;
    }
    
    const question = questionEl.value.trim();
    const answer = answerEl.value.trim();
    const category = categoryEl.value.trim();
    
    if (!question || !answer) {
      showError('Please enter both question and answer');
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
      questionEl.value = '';
      answerEl.value = '';
      categoryEl.value = 'general';
      
      // Show confirmation
      showSuccess('FAQ added successfully and will be used by the AI');
      
      // Refresh the FAQ list
      renderFAQs(storedFAQs);
      
      // Notify the user that the AI has been trained
      addMessage({
        role: 'agent',
        content: `I've been trained with your new FAQ about "${question}". You can now ask me questions related to this topic!`,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error adding FAQ:', error);
      showError('There was an error adding the FAQ');
    }
  }
  
  // Add a message to the widget UI
  function addWidgetMessage(message) {
    if (!widgetMessages) return;
    
    const messageEl = createMessageElement(message);
    widgetMessages.appendChild(messageEl);
    widgetMessages.scrollTop = widgetMessages.scrollHeight;
    
    // Add to state
    state.messages.push(message);
  }
  
  // Format timestamp
  function formatTime(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Now';
    }
  }
  
  // Escape HTML to prevent XSS
  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
    
    // Load data for specific views
    if (viewName === 'approvals' && state.user && state.user.role === 'agent') {
      loadPendingApprovals();
    } else if (viewName === 'faq-training' && state.user && state.user.role === 'agent') {
      loadExistingFAQs();
    }
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
    if (chatWidget) {
      chatWidget.classList.remove('hidden');
      state.widgetOpen = true;
      
      // Add welcome message if no messages yet
      if (widgetMessages && widgetMessages.children.length === 0) {
        addWidgetMessage({
          role: 'agent',
          content: `Hi! I'm ${state.companyConfig ? state.companyConfig.agentName : 'your support agent'}. How can I help you today?`,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  // Close chat widget
  function closeWidget() {
    if (chatWidget) {
      chatWidget.classList.add('hidden');
      state.widgetOpen = false;
    }
  }
  
  // Show error message
  function showError(message) {
    console.error('Error:', message);
    alert(`Error: ${message}`);
  }
  
  // Show success message
  function showSuccess(message) {
    console.log('Success:', message);
    // In a real app, you might use a toast notification here
    alert(`Success: ${message}`);
  }
  
  // Debounce utility function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Cleanup function for when the page is about to unload
  window.addEventListener('beforeunload', () => {
    // Close WebSocket connection if it exists
    if (state.socket) {
      state.socket.close();
    }
  });
  
  // Handle online/offline status
  window.addEventListener('online', () => {
    console.log('Connection restored');
    if (state.user) {
      connectWebSocket();
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('Connection lost');
    if (state.socket) {
      state.socket.close();
    }
  });
  
  // Initialize the application
  init();
  
  // Export for debugging (optional)
  if (typeof window !== 'undefined') {
    window.supportAgent = {
      state,
      functions: {
        login: handleLogin,
        logout,
        sendMessage,
        addMessage,
        showView
      }
    };
  }
});