/**
 * KernelWallet Alarms Manager
 * Manages all Chrome alarms for session timeout, health checks, and background tasks
 */

const ALARM_NAMES = {
  SESSION_TIMEOUT: 'kernelwallet-session-timeout',
  HEALTH_CHECK: 'kernelwallet-health-check',
  BALANCE_REFRESH: 'kernelwallet-balance-refresh',
  PHISHING_DB_UPDATE: 'kernelwallet-phishing-update',
  BACKUP_REMINDER: 'kernelwallet-backup-reminder',
  SECURITY_SCAN: 'kernelwallet-security-scan'
};

const ALARM_CONFIG = {
  [ALARM_NAMES.SESSION_TIMEOUT]: {
    periodInMinutes: 1, // Check every minute
    immediate: false
  },
  [ALARM_NAMES.HEALTH_CHECK]: {
    periodInMinutes: 5,
    immediate: true
  },
  [ALARM_NAMES.BALANCE_REFRESH]: {
    periodInMinutes: 2, // Refresh balances every 2 minutes when unlocked
    immediate: false
  },
  [ALARM_NAMES.PHISHING_DB_UPDATE]: {
    periodInMinutes: 60, // Update phishing DB every hour
    immediate: true
  },
  [ALARM_NAMES.BACKUP_REMINDER]: {
    periodInMinutes: 1440, // Daily reminder check
    immediate: false
  },
  [ALARM_NAMES.SECURITY_SCAN]: {
    periodInMinutes: 30, // Security scan every 30 minutes
    immediate: false
  }
};

/**
 * Initialize all alarms on startup
 */
async function initializeAlarms() {
  console.log('[KernelWallet] Initializing alarm system...');
  
  // Clear any existing alarms first
  await clearAllAlarms();
  
  // Create configured alarms
  for (const [name, config] of Object.entries(ALARM_CONFIG)) {
    await createAlarm(name, config);
  }
  
  console.log('[KernelWallet] All alarms initialized');
}

/**
 * Create a single alarm
 * @param {string} name 
 * @param {object} config 
 */
async function createAlarm(name, config) {
  try {
    await chrome.alarms.create(name, {
      periodInMinutes: config.periodInMinutes,
      delayInMinutes: config.immediate ? 0 : config.periodInMinutes
    });
  } catch (error) {
    console.error(`[KernelWallet] Failed to create alarm ${name}:`, error);
  }
}

/**
 * Clear all KernelWallet alarms
 */
async function clearAllAlarms() {
  const allAlarms = await chrome.alarms.getAll();
  const kwAlarms = allAlarms.filter(a => a.name.startsWith('kernelwallet-'));
  
  for (const alarm of kwAlarms) {
    await chrome.alarms.clear(alarm.name);
  }
}

/**
 * Clear specific alarm
 * @param {string} name 
 */
async function clearAlarm(name) {
  await chrome.alarms.clear(name);
}

/**
 * Get alarm status
 * @returns {Promise<<array>}
 */
async function getAlarmStatus() {
  const allAlarms = await chrome.alarms.getAll();
  return allAlarms
    .filter(a => a.name.startsWith('kernelwallet-'))
    .map(a => ({
      name: a.name,
      scheduledTime: a.scheduledTime,
      periodInMinutes: a.periodInMinutes,
      nextRun: new Date(a.scheduledTime).toISOString()
    }));
}

/**
 * Handle session timeout specifically
 * Calculates actual idle time and triggers lock
 */
async function handleSessionTimeout() {
  try {
    const session = await chrome.storage.session.get('kernelwallet_session_state');
    const state = session.kernelwallet_session_state;
    
    if (!state || !state.isUnlocked) return;
    
    const now = Date.now();
    const lastActivity = state.lastActivity || state.unlockedAt;
    const timeoutMs = (state.timeoutMinutes || 10) * 60 * 1000;
    const idle = now - lastActivity;
    
    // Warning at 80% of timeout
    if (idle > timeoutMs * 0.8 && idle < timeoutMs) {
      const remaining = Math.ceil((timeoutMs - idle) / 1000);
      await sendLockWarning(remaining);
    }
    
    // Lock at 100%
    if (idle >= timeoutMs) {
      await executeLock();
    }
  } catch (error) {
    console.error('[KernelWallet] Session timeout error:', error);
  }
}

/**
 * Send warning to popup before lock
 * @param {number} secondsRemaining 
 */
async function sendLockWarning(secondsRemaining) {
  try {
    await chrome.runtime.sendMessage({
      kernelwallet: true,
      type: 'SESSION_WARNING',
      payload: { secondsRemaining }
    });
  } catch (e) {
    // Popup not open
  }
}

/**
 * Execute vault lock
 */
async function executeLock() {
  console.log('[KernelWallet] Auto-lock triggered');
  
  // Clear session
  await chrome.storage.session.remove([
    'kernelwallet_session_state',
    'kw_decrypted_seed',
    'kw_private_keys'
  ]);
  
  // Notify all contexts
  try {
    await chrome.runtime.sendMessage({
      kernelwallet: true,
      type: 'FORCE_LOCK',
      payload: { reason: 'session_timeout' }
    });
  } catch (e) {}
  
  // Notify tabs
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          kernelwallet: true,
          type: 'WALLET_LOCKED'
        });
      } catch (e) {}
    }
  }
  
  // Show notification
  try {
    await chrome.notifications.create('auto-lock', {
      type: 'basic',
      iconUrl: 'public/icons/icon48.png',
      title: 'KernelWallet Secured',
      message: 'Your wallet has been automatically locked for security.',
      priority: 1
    });
  } catch (e) {}
}

/**
 * Handle balance refresh alarm
 */
async function handleBalanceRefresh() {
  const session = await chrome.storage.session.get('kernelwallet_session_state');
  if (!session.kernelwallet_session_state?.isUnlocked) return;
  
  // Would trigger background balance fetch here
  // For now, just log
  console.log('[KernelWallet] Background balance refresh tick');
}

/**
 * Handle phishing database update
 */
async function handlePhishingUpdate() {
  console.log('[KernelWallet] Checking phishing database updates...');
  
  // In production, fetch updated blacklist from server
  // For now, refresh from local storage
  try {
    const stored = await chrome.storage.local.get('kw_phishing_blacklist');
    if (stored.kw_phishing_blacklist) {
      console.log('[KernelWallet] Phishing DB loaded:', stored.kw_phishing_blacklist.length, 'entries');
    }
  } catch (e) {}
}

/**
 * Handle backup reminder
 */
async function handleBackupReminder() {
  const settings = await chrome.storage.local.get('kw_settings');
  const lastReminder = settings.kw_settings?.lastBackupReminder || 0;
  const daysSince = (Date.now() - lastReminder) / (1000 * 60 * 60 * 24);
  
  if (daysSince >= 7) {
    // Show backup reminder
    try {
      await chrome.notifications.create('backup-reminder', {
        type: 'basic',
        iconUrl: 'public/icons/icon48.png',
        title: 'Backup Your Wallet',
        message: 'Have you written down your seed phrase? Keep it safe!',
        priority: 1,
        buttons: [{ title: 'View Security Tips' }]
      });
      
      // Update last reminder
      const current = await chrome.storage.local.get('kw_settings');
      current.kw_settings = current.kw_settings || {};
      current.kw_settings.lastBackupReminder = Date.now();
      await chrome.storage.local.set(current);
    } catch (e) {}
  }
}

/**
 * Handle security scan
 */
async function handleSecurityScan() {
  console.log('[KernelWallet] Running security scan...');
  
  // Check for suspicious extensions
  try {
    const extensions = await chrome.management.getAll();
    const suspicious = extensions.filter(ext => {
      const name = ext.name.toLowerCase();
      return (
        name.includes('wallet') && 
        ext.id !== chrome.runtime.id &&
        !ext.enabled === false
      );
    });
    
    if (suspicious.length > 0) {
      console.warn('[KernelWallet] Potentially conflicting extensions:', suspicious.map(e => e.name));
    }
  } catch (e) {
    // management API might not be available
  }
}

/**
 * Pause all alarms (during sensitive operations)
 */
async function pauseAlarms() {
  console.log('[KernelWallet] Pausing alarms for sensitive operation');
  for (const name of Object.values(ALARM_NAMES)) {
    await chrome.alarms.clear(name);
  }
}

/**
 * Resume all alarms
 */
async function resumeAlarms() {
  console.log('[KernelWallet] Resuming alarms');
  await initializeAlarms();
}

/**
 * Reset session timeout alarm with new duration
 * @param {number} minutes 
 */
async function resetSessionAlarm(minutes) {
  await chrome.alarms.clear(ALARM_NAMES.SESSION_TIMEOUT);
  await chrome.alarms.create(ALARM_NAMES.SESSION_TIMEOUT, {
    periodInMinutes: 1,
    delayInMinutes: 1
  });
  
  // Update session state
  const session = await chrome.storage.session.get('kernelwallet_session_state');
  if (session.kernelwallet_session_state) {
    session.kernelwallet_session_state.timeoutMinutes = minutes;
    await chrome.storage.session.set(session);
  }
}

// Export for service worker
export {
  ALARM_NAMES,
  initializeAlarms,
  clearAllAlarms,
  clearAlarm,
  getAlarmStatus,
  handleSessionTimeout,
  handleBalanceRefresh,
  handlePhishingUpdate,
  handleBackupReminder,
  handleSecurityScan,
  pauseAlarms,
  resumeAlarms,
  resetSessionAlarm,
  executeLock
};
