/**
 * Customer Service AI Chat Widget
 * Embeddable chat widget for customer support
 */

(function() {
  'use strict';

  // Configuration
  const config = window.customerAIConfig || {};
  const API_BASE_URL = config.apiUrl || 'https://your-worker-url.workers.dev';
  const COMPANY_ID = config.companyId;

  if (!COMPANY_ID) {
    console.error('Customer AI Widget: companyId is required in customerAIConfig');
    return;
  }

  // Widget state
  let isOpen = false;
  let sessionId = generateSessionId();
  let messages = [];
  let widgetConfig = null;

  // Generate session ID
  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Fetch widget configuration
  async function fetchWidgetConfig() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/widget/config/${COMPANY_ID}`);
      const data = await response.json();
      if (data.success) {
        widgetConfig = data.data;
      }
    } catch (error) {
      console.error('Failed to fetch widget config:', error);
    }
  }

  // Create widget HTML
  function createWidget() {
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'customer-ai-widget';
    widgetContainer.innerHTML = `
      <style>
        #customer-ai-widget {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        #customer-ai-button {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${widgetConfig?.brandingPrimaryColor || '#4285F4'};
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        #customer-ai-button:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        #customer-ai-chat {
          position: fixed;
          bottom: 90px;
          right: 20px;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 120px);
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          display: none;
          flex-direction: column;
          overflow: hidden;
          transition: opacity 0.3s, transform 0.3s;
        }

        #customer-ai-chat.open {
          display: flex;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        #customer-ai-header {
          background: ${widgetConfig?.brandingPrimaryColor || '#4285F4'};
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        #customer-ai-header-title {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        #customer-ai-close {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        #customer-ai-close:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        #customer-ai-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: #f5f5f5;
        }

        .customer-ai-message {
          margin-bottom: 12px;
          display: flex;
          gap: 8px;
        }

        .customer-ai-message.user {
          flex-direction: row-reverse;
        }

        .customer-ai-message-content {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 12px;
          line-height: 1.4;
          font-size: 14px;
        }

        .customer-ai-message.bot .customer-ai-message-content {
          background: white;
          color: #333;
          border-bottom-left-radius: 4px;
        }

        .customer-ai-message.user .customer-ai-message-content {
          background: ${widgetConfig?.brandingPrimaryColor || '#4285F4'};
          color: white;
          border-bottom-right-radius: 4px;
        }

        #customer-ai-input-container {
          padding: 16px;
          background: white;
          border-top: 1px solid #e0e0e0;
          display: flex;
          gap: 8px;
        }

        #customer-ai-input {
          flex: 1;
          border: 1px solid #e0e0e0;
          border-radius: 20px;
          padding: 10px 16px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        #customer-ai-input:focus {
          border-color: ${widgetConfig?.brandingPrimaryColor || '#4285F4'};
        }

        #customer-ai-send {
          background: ${widgetConfig?.brandingPrimaryColor || '#4285F4'};
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
        }

        #customer-ai-send:hover {
          opacity: 0.9;
        }

        #customer-ai-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .customer-ai-typing {
          display: flex;
          gap: 4px;
          padding: 10px 14px;
          background: white;
          border-radius: 12px;
          width: fit-content;
        }

        .customer-ai-typing span {
          width: 8px;
          height: 8px;
          background: #999;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }

        .customer-ai-typing span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .customer-ai-typing span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-10px);
          }
        }

        @media (max-width: 480px) {
          #customer-ai-chat {
            width: calc(100vw - 40px);
            height: calc(100vh - 120px);
            right: 20px;
          }
        }
      </style>

      <button id="customer-ai-button" aria-label="Open chat">
        ${widgetConfig?.brandingLogo || '💬'}
      </button>

      <div id="customer-ai-chat">
        <div id="customer-ai-header">
          <div id="customer-ai-header-title">
            <span>${widgetConfig?.brandingLogo || '💬'}</span>
            <span>${widgetConfig?.agentName || 'Support'}</span>
          </div>
          <button id="customer-ai-close" aria-label="Close chat">×</button>
        </div>
        <div id="customer-ai-messages"></div>
        <div id="customer-ai-input-container">
          <input 
            type="text" 
            id="customer-ai-input" 
            placeholder="Type your message..."
            aria-label="Message input"
          />
          <button id="customer-ai-send" aria-label="Send message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(widgetContainer);

    // Event listeners
    document.getElementById('customer-ai-button').addEventListener('click', toggleChat);
    document.getElementById('customer-ai-close').addEventListener('click', toggleChat);
    document.getElementById('customer-ai-send').addEventListener('click', sendMessage);
    document.getElementById('customer-ai-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    // Show greeting message
    if (widgetConfig?.greetingMessage) {
      addMessage('bot', widgetConfig.greetingMessage);
    }
  }

  // Toggle chat window
  function toggleChat() {
    isOpen = !isOpen;
    const chatWindow = document.getElementById('customer-ai-chat');
    if (isOpen) {
      chatWindow.classList.add('open');
      document.getElementById('customer-ai-input').focus();
    } else {
      chatWindow.classList.remove('open');
    }
  }

  // Add message to chat
  function addMessage(sender, text) {
    const messagesContainer = document.getElementById('customer-ai-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `customer-ai-message ${sender}`;
    messageDiv.innerHTML = `
      <div class="customer-ai-message-content">${escapeHtml(text)}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    messages.push({ sender, text, timestamp: new Date().toISOString() });
  }

  // Show typing indicator
  function showTyping() {
    const messagesContainer = document.getElementById('customer-ai-messages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'customer-ai-typing-indicator';
    typingDiv.className = 'customer-ai-message bot';
    typingDiv.innerHTML = `
      <div class="customer-ai-typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Hide typing indicator
  function hideTyping() {
    const typingIndicator = document.getElementById('customer-ai-typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  // Send message
  async function sendMessage() {
    const input = document.getElementById('customer-ai-input');
    const message = input.value.trim();
    
    if (!message) return;

    // Add user message
    addMessage('user', message);
    input.value = '';

    // Disable send button
    const sendButton = document.getElementById('customer-ai-send');
    sendButton.disabled = true;

    // Show typing indicator
    showTyping();

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Company-ID': COMPANY_ID
        },
        body: JSON.stringify({
          message,
          companyId: COMPANY_ID,
          userId: config.user?.id || 'anonymous',
          sessionId
        })
      });

      const data = await response.json();
      
      // Hide typing indicator
      hideTyping();

      // Add bot response
      if (data.response) {
        addMessage('bot', data.response);
      } else {
        addMessage('bot', 'Sorry, I encountered an error. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      hideTyping();
      addMessage('bot', 'Sorry, I couldn\'t connect to the server. Please try again later.');
    } finally {
      sendButton.disabled = false;
      input.focus();
    }
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize widget
  async function init() {
    await fetchWidgetConfig();
    createWidget();
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
