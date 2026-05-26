/**
 * KernelWallet Message Handler
 * Secure message passing protocol between popup, content scripts, and background
 * All messages are validated, typed, and sanitized
 */

// Message types for validation
const VALID_MESSAGE_TYPES = new Set([
  // Vault
  'VAULT_UNLOCK', 'VAULT_LOCK', 'VAULT_STATUS',
  // Wallet
  'GET_WALLETS', 'CREATE_WALLET', 'IMPORT_WALLET', 
  'SWITCH_WALLET', 'DELETE_WALLET',
  // Account
  'GET_ACCOUNTS', 'ADD_ACCOUNT', 'GET_BALANCE',
  // Transaction
  'SEND_TX', 'GET_HISTORY', 'GET_PENDING', 'ESTIMATE_FEE',
  // Network
  'GET_NETWORKS', 'SWITCH_NETWORK', 'GET_ASSETS',
  // Security
  'CHECK_PHISHING', 'VALIDATE_ADDRESS', 'SESSION_PING',
  // UI
  'OPEN_POPUP', 'CLOSE_POPUP', 'NOTIFY'
]);

// Message origin validation
const ALLOWED_ORIGINS = new Set([
  'popup',      // Extension popup
  'content',    // Content script
  'background', // Service worker
  'offscreen'   // Offscreen document
]);

/**
 * Create a typed, secure message
 * @param {string} type - Message type
 * @param {object} payload - Message data
 * @param {string} origin - Sender origin
 * @returns {object} Structured message
 */
function createMessage(type, payload = {}, origin = 'popup') {
  if (!VALID_MESSAGE_TYPES.has(type)) {
    throw new Error(`Invalid message type: ${type}`);
  }
  
  if (!ALLOWED_ORIGINS.has(origin)) {
    throw new Error(`Invalid origin: ${origin}`);
  }
  
  return {
    kernelwallet: true,    // Protocol identifier
    version: '1.0.0',      // Protocol version
    timestamp: Date.now(),  // For replay attack prevention
    id: generateMessageId(), // Unique message ID
    type: type,
    origin: origin,
    payload: sanitizePayload(payload)
  };
}

/**
 * Validate incoming message structure
 * @param {object} message 
 * @returns {boolean}
 */
function validateMessage(message) {
  if (!message || typeof message !== 'object') return false;
  
  // Check protocol identifier
  if (message.kernelwallet !== true) return false;
  
  // Check version compatibility
  if (!message.version || message.version !== '1.0.0') return false;
  
  // Check timestamp (prevent replay attacks > 5 min old)
  if (!message.timestamp || (Date.now() - message.timestamp) > 300000) return false;
  
  // Check required fields
  if (!message.id || !message.type || !message.origin) return false;
  
  // Validate type
  if (!VALID_MESSAGE_TYPES.has(message.type)) return false;
  
  // Validate origin
  if (!ALLOWED_ORIGINS.has(message.origin)) return false;
  
  // Validate payload is object
  if (message.payload && typeof message.payload !== 'object') return false;
  
  return true;
}

/**
 * Sanitize payload to prevent injection
 * @param {object} payload 
 * @returns {object}
 */
function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(payload)) {
    // Sanitize string values
    if (typeof value === 'string') {
      sanitized[key] = value
        .replace(/[<>]/g, '') // Remove HTML tags
        .substring(0, 10000);  // Limit length
    } 
    // Allow numbers
    else if (typeof value === 'number') {
      sanitized[key] = value;
    }
    // Allow booleans
    else if (typeof value === 'boolean') {
      sanitized[key] = value;
    }
    // Allow arrays (shallow)
    else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 1000); // Limit array size
    }
    // Nested objects - one level deep only
    else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value);
    }
    // Reject functions, symbols, etc.
    else {
      sanitized[key] = null;
    }
  }
  
  return sanitized;
}

/**
 * Send message to background with response
 * @param {string} type 
 * @param {object} payload 
 * @returns {Promise<object>}
 */
async function sendToBackground(type, payload = {}) {
  const message = createMessage(type, payload, 'popup');
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (!response) {
        reject(new Error('No response from background'));
        return;
      }
      
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      
      resolve(response);
    });
  });
}

/**
 * Send message to content script
 * @param {number} tabId 
 * @param {string} type 
 * @param {object} payload 
 */
async function sendToContent(tabId, type, payload = {}) {
  const message = createMessage(type, payload, 'background');
  
  return chrome.tabs.sendMessage(tabId, message).catch(error => {
    console.warn(`Failed to send to tab ${tabId}:`, error);
    return null;
  });
}

/**
 * Send message to popup (from background)
 * @param {string} type 
 * @param {object} payload 
 */
async function sendToPopup(type, payload = {}) {
  const message = createMessage(type, payload, 'background');
  
  // Broadcast to all extension contexts
  return chrome.runtime.sendMessage(message).catch(error => {
    // Popup might not be open
    return null;
  });
}

/**
 * Broadcast to all tabs
 * @param {string} type 
 * @param {object} payload 
 */
async function broadcastToTabs(type, payload = {}) {
  const message = createMessage(type, payload, 'background');
  const tabs = await chrome.tabs.query({});
  
  const promises = tabs.map(tab => {
    if (tab.id) {
      return chrome.tabs.sendMessage(tab.id, message).catch(() => null);
    }
    return Promise.resolve(null);
  });
  
  return Promise.all(promises);
}

/**
 * Generate unique message ID
 * @returns {string}
 */
function generateMessageId() {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `kw_${time}_${random}`;
}

/**
 * Create error response
 * @param {string} error 
 * @param {number} code 
 * @returns {object}
 */
function createError(error, code = 500) {
  return {
    success: false,
    error: error,
    code: code,
    timestamp: Date.now()
  };
}

/**
 * Create success response
 * @param {object} data 
 * @returns {object}
 */
function createSuccess(data = {}) {
  return {
    success: true,
    data: data,
    timestamp: Date.now()
  };
}

// ===== CONTENT SCRIPT BRIDGE =====
// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!validateMessage(message)) {
    sendResponse(createError('Invalid message format', 400));
    return false;
  }
  
  handleValidatedMessage(message, sender).then(response => {
    sendResponse(response);
  }).catch(error => {
    sendResponse(createError(error.message, 500));
  });
  
  return true; // Async
});

async function handleValidatedMessage(message, sender) {
  const { type, payload } = message;
  
  // Route to appropriate handler
  switch (type) {
    case 'CHECK_PHISHING':
      const { checkUrl } = await import('../security/phishing-detector.js');
      return createSuccess(checkUrl(payload.url));
      
    case 'SESSION_PING':
      return createSuccess({ active: true, timestamp: Date.now() });
      
    case 'VAULT_STATUS':
      return createSuccess({ 
        unlocked: await isVaultUnlockedSafe(),
        timestamp: Date.now() 
      });
      
    default:
      return createError('Handler not implemented in message router', 501);
  }
}

/**
 * Safe vault status check
 */
async function isVaultUnlockedSafe() {
  try {
    const session = await chrome.storage.session.get('kernelwallet_session_state');
    return !!(session.kernelwallet_session_state?.isUnlocked);
  } catch (e) {
    return false;
  }
}

export {
  createMessage,
  validateMessage,
  sanitizePayload,
  sendToBackground,
  sendToContent,
  sendToPopup,
  broadcastToTabs,
  generateMessageId,
  createError,
  createSuccess,
  VALID_MESSAGE_TYPES,
  ALLOWED_ORIGINS
};
