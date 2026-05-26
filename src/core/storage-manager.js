/**
 * KernelWallet Storage Manager
 * Secure encrypted storage using Chrome Storage API + AES-GCM
 */

import { encrypt, decrypt } from '../security/encryption.js';

const STORAGE_KEYS = {
  WALLETS: 'kw_wallets_v1',
  ACCOUNTS: 'kw_accounts_v1',
  TRANSACTIONS: 'kw_transactions_v1',
  SETTINGS: 'kw_settings_v1',
  NETWORKS: 'kw_networks_v1',
  SESSION: 'kw_session_v1'
};

/**
 * Save data to Chrome storage (encrypted if sensitive)
 * @param {string} key - Storage key
 * @param {any} data - Data to store
 * @param {boolean} encryptData - Whether to encrypt
 * @param {string} password - Password for encryption
 */
async function setItem(key, data, encryptData = false, password = null) {
  try {
    let storedValue = data;
    
    if (encryptData && password) {
      const jsonString = JSON.stringify(data);
      storedValue = await encrypt(jsonString, password);
    } else if (encryptData && !password) {
      throw new Error('Password required for encrypted storage');
    }
    
    await chrome.storage.local.set({ [key]: storedValue });
    return true;
  } catch (error) {
    console.error(`Storage set error [${key}]:`, error);
    throw new Error('Failed to save data');
  }
}

/**
 * Get data from Chrome storage
 * @param {string} key - Storage key
 * @param {boolean} encrypted - Whether data is encrypted
 * @param {string} password - Password for decryption
 * @returns {Promise<any>} Stored data
 */
async function getItem(key, encrypted = false, password = null) {
  try {
    const result = await chrome.storage.local.get(key);
    const storedValue = result[key];
    
    if (storedValue === undefined || storedValue === null) {
      return null;
    }
    
    if (encrypted) {
      if (!password) throw new Error('Password required for decryption');
      const decrypted = await decrypt(storedValue, password);
      return JSON.parse(decrypted);
    }
    
    return storedValue;
  } catch (error) {
    console.error(`Storage get error [${key}]:`, error);
    throw new Error('Failed to read data');
  }
}

/**
 * Remove item from storage
 * @param {string} key 
 */
async function removeItem(key) {
  await chrome.storage.local.remove(key);
}

/**
 * Clear all wallet data (DANGER - for reset only)
 */
async function clearAll() {
  await chrome.storage.local.clear();
}

/**
 * Save wallet vault (encrypted)
 * @param {object} vault - Wallet data
 * @param {string} password - User password
 */
async function saveWalletVault(vault, password) {
  return setItem(STORAGE_KEYS.WALLETS, vault, true, password);
}

/**
 * Load wallet vault (decrypted)
 * @param {string} password - User password
 * @returns {Promise<object|null>}
 */
async function loadWalletVault(password) {
  return getItem(STORAGE_KEYS.WALLETS, true, password);
}

/**
 * Save transactions (unencrypted - not sensitive)
 * @param {array} transactions 
 */
async function saveTransactions(transactions) {
  return setItem(STORAGE_KEYS.TRANSACTIONS, transactions, false);
}

/**
 * Load transactions
 * @returns {Promise<<array>}
 */
async function loadTransactions() {
  const data = await getItem(STORAGE_KEYS.TRANSACTIONS, false);
  return data || [];
}

/**
 * Save settings
 * @param {object} settings 
 */
async function saveSettings(settings) {
  return setItem(STORAGE_KEYS.SETTINGS, settings, false);
}

/**
 * Load settings
 * @returns {Promise<object>}
 */
async function loadSettings() {
  const data = await getItem(STORAGE_KEYS.SETTINGS, false);
  return data || {
    defaultNetwork: 'ethereum',
    sessionTimeout: 10,
    language: 'en',
    currency: 'USD'
  };
}

/**
 * Save session state (temporary - in session storage)
 * @param {object} state 
 */
async function saveSessionState(state) {
  await chrome.storage.session.set({ [STORAGE_KEYS.SESSION]: state });
}

/**
 * Load session state
 * @returns {Promise<object|null>}
 */
async function loadSessionState() {
  const result = await chrome.storage.session.get(STORAGE_KEYS.SESSION);
  return result[STORAGE_KEYS.SESSION] || null;
}

/**
 * Clear session state (on lock)
 */
async function clearSessionState() {
  await chrome.storage.session.remove(STORAGE_KEYS.SESSION);
}

/**
 * Check if wallet exists (first-time user check)
 * @returns {Promise<boolean>}
 */
async function hasWallet() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WALLETS);
  return !!result[STORAGE_KEYS.WALLETS];
}

export {
  setItem,
  getItem,
  removeItem,
  clearAll,
  saveWalletVault,
  loadWalletVault,
  saveTransactions,
  loadTransactions,
  saveSettings,
  loadSettings,
  saveSessionState,
  loadSessionState,
  clearSessionState,
  hasWallet,
  STORAGE_KEYS
};
