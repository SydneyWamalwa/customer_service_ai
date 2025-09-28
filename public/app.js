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
    socket: null
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
    // Login button
    loginBtn.addEventListener('click', handleLogin);
    
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
  }
  
  // Handle login
  function handleLogin() {
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
      name: email.split('@')[0]
    };
    
    state.companyId = companyId;
    state.companyConfig = companyConfigs[companyId];
    
    // Save to cookies
    Cookies.set('user', JSON.stringify(state.user), { expires: 7 });
    Cookies.set('companyId', companyId, { expires: 7 });
    
    loginSuccess();
  }
  
  // Login success
  function loginSuccess() {
    // Generate a session ID
    state.sessionId = 'session-' + Date.now();
    
    // Update UI with company branding
    updateBranding();
    
    // Show chat container
    loginContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    
    // Update user info
    userName.textContent = state.user.name;
    
    // Connect to WebSocket
    connectWebSocket();
    
    // Add welcome message
    addMessage({
      role: 'agent',
      content: `Welcome to ${state.companyConfig.branding.companyName} support! How can I help you today?`,
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
      widgetOpen: false
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
    
    // Send to API
    sendToAPI(message);
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