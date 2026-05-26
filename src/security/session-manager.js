/**
 * KernelWallet Session Manager
 * Handles automatic lock after inactivity
 * Uses Chrome alarms API for background timeout
 */

const SESSION_CONFIG = {
  defaultTimeout: 10, // minutes
  alarmName: 'kernelwallet-session-timeout',
  storageKey: 'kernelwallet_session_state'
};

let sessionState = {
  isUnlocked: false,
  unlockedAt: null,
  lastActivity: null,
  timeoutMinutes: SESSION_CONFIG.defaultTimeout
};

/**
 * Initialize session manager
 */
function initSessionManager() {
  // Listen for alarm
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.onAlarm.addListener(handleAlarm);
  }
  
  // Listen for activity
  document.addEventListener('click', recordActivity);
  document.addEventListener('keydown', recordActivity);
  document.addEventListener('mousemove', recordActivity);
}

/**
 * Record user activity to prevent auto-lock
 */
function recordActivity() {
  if (sessionState.isUnlocked) {
    sessionState.lastActivity = Date.now();
    resetSessionAlarm();
  }
}

/**
 * Start a new session after unlock
 * @param {number} timeoutMinutes - Auto-lock timeout
 */
async function startSession(timeoutMinutes = SESSION_CONFIG.defaultTimeout) {
  sessionState = {
    isUnlocked: true,
    unlockedAt: Date.now(),
    lastActivity: Date.now(),
    timeoutMinutes: timeoutMinutes
  };
  
  await saveSessionState();
  setSessionAlarm(timeoutMinutes);
}

/**
 * Lock session immediately
 */
async function lockSession() {
  sessionState.isUnlocked = false;
  sessionState.unlockedAt = null;
  sessionState.lastActivity = null;
  
  await saveSessionState();
  clearSessionAlarm();
  
  // Notify background
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ action: 'session_locked' });
  }
}

/**
 * Check if session is currently unlocked
 * @returns {boolean}
 */
function isSessionUnlocked() {
  if (!sessionState.isUnlocked) return false;
  
  // Check if timed out manually (fallback if alarm fails)
  const inactive = Date.now() - sessionState.lastActivity;
  const timeoutMs = sessionState.timeoutMinutes * 60 * 1000;
  
  if (inactive > timeoutMs) {
    lockSession();
    return false;
  }
  
  return true;
}

/**
 * Set Chrome alarm for session timeout
 * @param {number} minutes 
 */
function setSessionAlarm(minutes) {
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.create(SESSION_CONFIG.alarmName, {
      delayInMinutes: minutes,
      periodInMinutes: minutes
    });
  }
}

/**
 * Reset session alarm after activity
 */
function resetSessionAlarm() {
  clearSessionAlarm();
  setSessionAlarm(sessionState.timeoutMinutes);
}

/**
 * Clear session alarm
 */
function clearSessionAlarm() {
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.clear(SESSION_CONFIG.alarmName);
  }
}

/**
 * Handle alarm trigger
 * @param {object} alarm 
 */
function handleAlarm(alarm) {
  if (alarm.name === SESSION_CONFIG.alarmName) {
    const inactive = Date.now() - sessionState.lastActivity;
    const timeoutMs = sessionState.timeoutMinutes * 60 * 1000;
    
    if (inactive >= timeoutMs) {
      lockSession();
      
      // Close popup if open
      if (typeof chrome !== 'undefined' && chrome.windows) {
        chrome.windows.getCurrent({}, (window) => {
          if (window.type === 'popup') {
            chrome.windows.remove(window.id);
          }
        });
      }
    }
  }
}

/**
 * Save session state to storage
 */
async function saveSessionState() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await chrome.storage.session.set({
      [SESSION_CONFIG.storageKey]: sessionState
    });
  }
}

/**
 * Load session state from storage
 */
async function loadSessionState() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const result = await chrome.storage.session.get(SESSION_CONFIG.storageKey);
    if (result[SESSION_CONFIG.storageKey]) {
      sessionState = result[SESSION_CONFIG.storageKey];
    }
  }
}

/**
 * Get session info
 * @returns {object}
 */
function getSessionInfo() {
  return {
    isUnlocked: sessionState.isUnlocked,
    unlockedAt: sessionState.unlockedAt,
    inactiveSeconds: sessionState.lastActivity ? 
      Math.floor((Date.now() - sessionState.lastActivity) / 1000) : null,
    timeoutMinutes: sessionState.timeoutMinutes
  };
}

/**
 * Update session timeout setting
 * @param {number} minutes 
 */
function setTimeoutDuration(minutes) {
  if (minutes < 1 || minutes > 60) {
    throw new Error('Timeout must be between 1 and 60 minutes');
  }
  sessionState.timeoutMinutes = minutes;
  if (sessionState.isUnlocked) {
    resetSessionAlarm();
  }
}

export {
  initSessionManager,
  startSession,
  lockSession,
  isSessionUnlocked,
  recordActivity,
  saveSessionState,
  loadSessionState,
  getSessionInfo,
  setTimeoutDuration,
  SESSION_CONFIG
};
