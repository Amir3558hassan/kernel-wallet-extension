/**
 * KernelWallet Background Service Worker
 * Core controller that runs persistently in the browser background
 * Handles messages, alarms, storage, and secure state management
 */

import { initSessionManager, lockSession, isSessionUnlocked, SESSION_CONFIG } from '../security/session-manager.js';
import { checkUrl, blockPageInteraction } from '../security/phishing-detector.js';
import { isVaultUnlocked, lockVault } from '../core/wallet-manager.js';

// ===== STATE MANAGEMENT =====
const SW_STATE = {
  initialized: false,
  vaultUnlocked: false,
  lastActivity: Date.now(),
  activeTabId: null,
  blockedTabs: new Set()
};

// ===== INITIALIZATION =====
chrome.runtime.onStartup.addListener(async () => {
  console.log('[KernelWallet] Service Worker started');
  await initializeServiceWorker();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[KernelWallet] Extension installed/updated:', details.reason);
  await initializeServiceWorker();
  
  if (details.reason === 'install') {
    // First install - set defaults
    await chrome.storage.local.set({
      'kw_first_install': Date.now(),
      'kw_version': chrome.runtime.getManifest().version
    });
  }
});

/**
 * Initialize service worker state
 */
async function initializeServiceWorker() {
  if (SW_STATE.initialized) return;
  
  try {
    // Load session state from session storage
    const session = await chrome.storage.session.get('kernelwallet_session_state');
    if (session.kernelwallet_session_state) {
      SW_STATE.vaultUnlocked = session.kernelwallet_session_state.isUnlocked || false;
    }
    
    // Initialize session manager
    initSessionManager();
    
    // Set up periodic health check alarm
    chrome.alarms.create('health-check', {
      periodInMinutes: 1
    });
    
    SW_STATE.initialized = true;
    console.log('[KernelWallet] Service Worker initialized successfully');
  } catch (error) {
    console.error('[KernelWallet] Initialization failed:', error);
  }
}

// ===== MESSAGE HANDLING =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async operations properly
  handleMessage(message, sender).then(sendResponse).catch(error => {
    console.error('[KernelWallet] Message handler error:', error);
    sendResponse({ success: false, error: error.message });
  });
  
  return true; // Keep channel open for async
});

/**
 * Route messages to appropriate handlers
 */
async function handleMessage(message, sender) {
  const { action, data } = message;
  
  // Validate sender
  if (!validateSender(sender)) {
    throw new Error('Invalid message sender');
  }
  
  switch (action) {
    // === VAULT OPERATIONS ===
    case 'vault_unlocked':
      SW_STATE.vaultUnlocked = true;
      SW_STATE.lastActivity = Date.now();
      return { success: true, state: 'unlocked' };
      
    case 'vault_locked':
      await handleVaultLock();
      return { success: true, state: 'locked' };
      
    case 'get_vault_status':
      return { 
        unlocked: SW_STATE.vaultUnlocked,
        timestamp: SW_STATE.lastActivity 
      };
      
    // === SESSION OPERATIONS ===
    case 'record_activity':
      SW_STATE.lastActivity = Date.now();
      return { success: true };
      
    case 'check_session':
      return { 
        active: isSessionUnlocked(),
        lastActivity: SW_STATE.lastActivity 
      };
      
    // === PHISHING PROTECTION ===
    case 'check_url':
      if (!data || !data.url) throw new Error('URL required');
      const urlCheck = checkUrl(data.url);
      if (!urlCheck.safe && sender.tab && sender.tab.id) {
        SW_STATE.blockedTabs.add(sender.tab.id);
      }
      return urlCheck;
      
    case 'block_tab':
      if (sender.tab && sender.tab.id) {
        SW_STATE.blockedTabs.add(sender.tab.id);
        await chrome.tabs.sendMessage(sender.tab.id, { 
          action: 'block_page', 
          reason: data?.reason || 'Security threat detected' 
        }).catch(() => {});
      }
      return { success: true };
      
    // === WALLET OPERATIONS ===
    case 'get_balance':
      // Forward to WDK adapter (simplified)
      return { success: true, balance: '0', mock: true };
      
    case 'send_transaction':
      // Validate session is active before allowing sends
      if (!SW_STATE.vaultUnlocked) {
        throw new Error('Wallet is locked. Unlock to send transactions.');
      }
      SW_STATE.lastActivity = Date.now();
      return { success: true, txHash: '0x' + generateMockHash(), status: 'pending' };
      
    // === TAB MANAGEMENT ===
    case 'get_active_tab':
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return { tab: activeTab || null };
      
    case 'open_popup':
      await chrome.action.openPopup();
      return { success: true };
      
    // === STORAGE CLEANUP ===
    case 'clear_sensitive_data':
      await clearSensitiveMemory();
      return { success: true };
      
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Validate message sender origin
 */
function validateSender(sender) {
  if (!sender) return false;
  
  // Accept from extension itself
  if (sender.id === chrome.runtime.id) return true;
  
  // Accept from content scripts on any URL (they're injected by us)
  if (sender.url && sender.url.startsWith('chrome-extension://' + chrome.runtime.id)) return true;
  
  return false;
}

/**
 * Handle vault lock from any context
 */
async function handleVaultLock() {
  SW_STATE.vaultUnlocked = false;
  SW_STATE.lastActivity = 0;
  
  // Clear all sensitive session storage
  await clearSensitiveMemory();
  
  // Notify all extension contexts to lock
  try {
    await chrome.runtime.sendMessage({ 
      action: 'force_lock', 
      reason: 'session_timeout' 
    });
  } catch (e) {
    // Popup might not be open - ignore error
  }
  
  console.log('[KernelWallet] Vault locked securely');
}

/**
 * Clear sensitive data from memory and storage
 */
async function clearSensitiveMemory() {
  // Clear session storage (temporary)
  await chrome.storage.session.remove([
    'kernelwallet_session_state',
    'kw_pending_transactions',
    'kw_decrypted_vault'
  ]);
  
  // Note: Local storage keeps encrypted vault - that's safe
}

// ===== ALARM HANDLING =====
chrome.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case SESSION_CONFIG.alarmName:
      await handleSessionTimeoutAlarm();
      break;
      
    case 'health-check':
      await handleHealthCheck();
      break;
      
    case 'balance-refresh':
      // Could trigger background balance updates
      break;
      
    default:
      console.log('[KernelWallet] Unknown alarm:', alarm.name);
  }
});

/**
 * Handle session timeout alarm
 */
async function handleSessionTimeoutAlarm() {
  if (!SW_STATE.vaultUnlocked) return;
  
  const inactive = Date.now() - SW_STATE.lastActivity;
  const timeoutMs = SESSION_CONFIG.defaultTimeout * 60 * 1000;
  
  if (inactive >= timeoutMs) {
    console.log('[KernelWallet] Session timeout - auto locking');
    await handleVaultLock();
    
    // Show notification to user
    try {
      await chrome.notifications.create('session-timeout', {
        type: 'basic',
        iconUrl: 'public/icons/icon128.png',
        title: 'KernelWallet Locked',
        message: 'Your wallet was automatically locked due to inactivity.',
        priority: 1
      });
    } catch (e) {
      // Notifications might not be permitted
    }
  }
}

/**
 * Periodic health check
 */
async function handleHealthCheck() {
  // Check if vault should be locked
  if (SW_STATE.vaultUnlocked) {
    const inactive = Date.now() - SW_STATE.lastActivity;
    const warningTime = (SESSION_CONFIG.defaultTimeout * 60 * 1000) - 60000; // 1 min before lock
    
    if (inactive >= warningTime && inactive < (SESSION_CONFIG.defaultTimeout * 60 * 1000)) {
      // Warn popup if open
      try {
        await chrome.runtime.sendMessage({ 
          action: 'session_warning', 
          secondsRemaining: Math.floor(((SESSION_CONFIG.defaultTimeout * 60 * 1000) - inactive) / 1000)
        });
      } catch (e) {
        // Popup not open
      }
    }
  }
  
  // Clean up old blocked tabs
  const allTabs = await chrome.tabs.query({});
  const activeTabIds = new Set(allTabs.map(t => t.id));
  for (const tabId of SW_STATE.blockedTabs) {
    if (!activeTabIds.has(tabId)) {
      SW_STATE.blockedTabs.delete(tabId);
    }
  }
}

// ===== TAB EVENT LISTENERS =====
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check URL for phishing
    const check = checkUrl(tab.url);
    if (!check.safe) {
      console.warn('[KernelWallet] Phishing detected:', tab.url, check.reason);
      SW_STATE.blockedTabs.add(tabId);
      
      // Inject warning
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: injectPhishingWarning,
          args: [check.reason, tab.url]
        });
      } catch (e) {
        console.error('Failed to inject warning:', e);
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  SW_STATE.blockedTabs.delete(tabId);
});

/**
 * Function injected into page to show phishing warning
 */
function injectPhishingWarning(reason, url) {
  // This runs in page context
  if (document.getElementById('kernelwallet-phishing-block')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'kernelwallet-phishing-block';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(10, 10, 30, 0.95);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  overlay.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 40px;
      border-radius: 20px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      color: #fff;
      border: 2px solid #e74c3c;
      box-shadow: 0 20px 60px rgba(231, 76, 60, 0.3);
    ">
      <div style="font-size: 60px; margin-bottom: 20px;">🛡️</div>
      <h2 style="color: #e74c3c; margin: 0 0 15px 0; font-size: 24px;">Security Alert</h2>
      <p style="color: #a0a0a0; margin-bottom: 10px; line-height: 1.6; font-size: 14px;">
        KernelWallet has detected a potentially malicious website.
      </p>
      <p style="color: #e74c3c; margin-bottom: 25px; font-weight: 600; font-size: 13px; padding: 10px; background: rgba(231,76,60,0.1); border-radius: 8px;">
        ${reason}
      </p>
      <p style="color: #ff6b6b; font-size: 12px; margin-bottom: 25px;">
        URL: ${url.substring(0, 50)}...
      </p>
      <button onclick="window.location.href='about:blank'" style="
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        color: white;
        border: none;
        padding: 14px 32px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        width: 100%;
        transition: transform 0.2s;
      " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
        Leave Site Immediately
      </button>
      <p style="color: #666; font-size: 11px; margin-top: 15px;">
        This protection is powered by KernelWallet security engine.
      </p>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

// ===== ACTION BUTTON (ICON CLICK) =====
chrome.action.onClicked.addListener(async (tab) => {
  // This only fires if no popup is set, but we have popup set in manifest
  // So this is a fallback
  console.log('[KernelWallet] Action clicked');
});

// ===== OFFSCREEN DOCUMENT (for DOM operations in background) =====
let creatingOffscreen;
async function setupOffscreenDocument(path) {
  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    
    if (existingContexts.length > 0) {
      return;
    }
    
    creatingOffscreen = chrome.offscreen.createDocument({
      url: path,
      reasons: ['WORKERS'],
      justification: 'Perform cryptographic operations requiring DOM access'
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

// ===== MOCK HELPERS =====
function generateMockHash() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ===== EXTERNAL MESSAGE HANDLING (dApp connection) =====
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Handle messages from external websites (dApp connection requests)
  handleExternalMessage(message, sender).then(sendResponse).catch(error => {
    sendResponse({ success: false, error: error.message });
  });
  return true;
});

async function handleExternalMessage(message, sender) {
  const { action, data } = message;
  
  // Validate origin
  const senderUrl = new URL(sender.url || 'https://unknown.com');
  const check = checkUrl(sender.url);
  
  if (!check.safe) {
    throw new Error('Connection rejected: Unsafe origin');
  }
  
  switch (action) {
    case 'eth_requestAccounts':
      // dApp asking for account access
      if (!SW_STATE.vaultUnlocked) {
        // Prompt user to unlock
        await chrome.action.openPopup();
        return { success: false, error: 'Wallet locked', code: 4001 };
      }
      return { success: true, accounts: [] }; // Would return real accounts
      
    case 'eth_sendTransaction':
      if (!SW_STATE.vaultUnlocked) {
        return { success: false, error: 'Wallet locked', code: 4001 };
      }
      // Would show confirmation popup
      return { success: true, txHash: '0x' + generateMockHash() };
      
    default:
      throw new Error('Unsupported method');
  }
}

console.log('[KernelWallet] Service Worker loaded');
