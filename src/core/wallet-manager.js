/**
 * KernelWallet Wallet Manager
 * Manages multiple wallets, each with seed phrase derivation
 * Supports create, import, recover, delete, switch operations
 */

import { 
  generateSeedPhrase, 
  generateSeedPhrase24, 
  validateSeedPhrase, 
  mnemonicToSeed 
} from '../security/seed-phrase.js';
import { 
  saveWalletVault, 
  loadWalletVault, 
  hasWallet, 
  saveSettings, 
  loadSettings 
} from './storage-manager.js';
import { generateUUID, deterministicId } from './crypto-utils.js';

// In-memory vault (cleared on lock)
let vaultCache = null;
let vaultPassword = null;

/**
 * Wallet structure:
 * {
 *   id: string,
 *   name: string,
 *   createdAt: timestamp,
 *   encryptedSeed: string, (encrypted with password)
 *   accounts: array,
 *   isActive: boolean
 * }
 */

/**
 * Initialize wallet system
 * @returns {Promise<object>} Status
 */
async function initWalletSystem() {
  const exists = await hasWallet();
  return {
    hasWallet: exists,
    isUnlocked: !!vaultCache,
    activeWallet: vaultCache ? getActiveWalletId() : null
  };
}

/**
 * Create new wallet with seed phrase
 * @param {string} password - User password
 * @param {string} walletName - Optional name
 * @param {boolean} use24Words - 24 words instead of 12
 * @returns {Promise<object>} New wallet + seed phrase (shown once)
 */
async function createWallet(password, walletName = 'My Wallet', use24Words = false) {
  try {
    // Validate password strength
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Generate seed phrase
    const seedPhrase = use24Words 
      ? await generateSeedPhrase24() 
      : await generateSeedPhrase();
    
    // Validate generated phrase
    if (!validateSeedPhrase(seedPhrase)) {
      throw new Error('Generated seed phrase is invalid');
    }

    // Derive seed bytes
    const seedBytes = await mnemonicToSeed(seedPhrase);
    
    // Create wallet object
    const walletId = await deterministicId(seedPhrase + Date.now());
    const wallet = {
      id: walletId,
      name: walletName,
      createdAt: Date.now(),
      seedHash: await sha256Quick(seedPhrase), // For verification, not storage
      accounts: [],
      isActive: true,
      version: 1
    };

    // Derive first account (index 0) for each supported network
    const firstAccount = await deriveAccount(walletId, seedPhrase, 0, 'ethereum');
    wallet.accounts.push(firstAccount);

    // Encrypt and save
    await saveWalletData(wallet, password);
    
    // Set as active
    await setActiveWallet(walletId, password);

    // Return seed phrase ONCE to user (they must write it down)
    return {
      success: true,
      wallet: {
        id: wallet.id,
        name: wallet.name,
        createdAt: wallet.createdAt,
        accounts: wallet.accounts
      },
      seedPhrase: seedPhrase, // ⚠️ SHOW ONLY ONCE
      warning: 'Write down this seed phrase and store it securely. It will never be shown again.'
    };
    
  } catch (error) {
    console.error('Wallet creation failed:', error);
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
}

/**
 * Import wallet from existing seed phrase
 * @param {string} seedPhrase - User's seed phrase
 * @param {string} password - New password
 * @param {string} walletName 
 * @returns {Promise<object>} Imported wallet
 */
async function importWallet(seedPhrase, password, walletName = 'Imported Wallet') {
  try {
    // Validate phrase
    if (!validateSeedPhrase(seedPhrase)) {
      throw new Error('Invalid seed phrase. Must be 12 or 24 words.');
    }

    // Check if already exists
    const existing = await getWalletBySeedHash(await sha256Quick(seedPhrase));
    if (existing) {
      throw new Error('This wallet already exists in your vault');
    }

    // Derive seed
    const seedBytes = await mnemonicToSeed(seedPhrase);
    
    const walletId = await deterministicId(seedPhrase + Date.now());
    const wallet = {
      id: walletId,
      name: walletName,
      createdAt: Date.now(),
      seedHash: await sha256Quick(seedPhrase),
      accounts: [],
      isActive: false,
      version: 1
    };

    // Derive accounts for all major networks
    const networks = ['ethereum', 'bitcoin', 'solana'];
    for (const network of networks) {
      const account = await deriveAccount(walletId, seedPhrase, 0, network);
      wallet.accounts.push(account);
    }

    await saveWalletData(wallet, password);
    
    return {
      success: true,
      wallet: {
        id: wallet.id,
        name: wallet.name,
        accounts: wallet.accounts
      },
      message: 'Wallet imported successfully'
    };
    
  } catch (error) {
    console.error('Wallet import failed:', error);
    throw new Error(`Failed to import wallet: ${error.message}`);
  }
}

/**
 * Unlock vault with password
 * @param {string} password 
 * @returns {Promise<object>} Vault data
 */
async function unlockVault(password) {
  try {
    const vault = await loadWalletVault(password);
    if (!vault) {
      throw new Error('No wallet found or incorrect password');
    }

    vaultCache = vault;
    vaultPassword = password;

    return {
      success: true,
      wallets: vault.wallets.map(w => ({
        id: w.id,
        name: w.name,
        isActive: w.isActive,
        accountCount: w.accounts.length,
        createdAt: w.createdAt
      }))
    };
  } catch (error) {
    console.error('Vault unlock failed:', error);
    throw new Error('Incorrect password or corrupted data');
  }
}

/**
 * Lock vault (clear memory)
 */
function lockVault() {
  vaultCache = null;
  vaultPassword = null;
  
  // Force garbage collection hint
  if (globalThis.gc) globalThis.gc();
}

/**
 * Check if vault is unlocked
 * @returns {boolean}
 */
function isVaultUnlocked() {
  return !!vaultCache;
}

/**
 * Get current vault data (unlocked only)
 * @returns {object|null}
 */
function getVault() {
  if (!vaultCache) return null;
  return vaultCache;
}

/**
 * Get active wallet
 * @returns {object|null}
 */
function getActiveWallet() {
  if (!vaultCache) return null;
  return vaultCache.wallets.find(w => w.isActive) || vaultCache.wallets[0] || null;
}

/**
 * Get active wallet ID
 * @returns {string|null}
 */
function getActiveWalletId() {
  const wallet = getActiveWallet();
  return wallet ? wallet.id : null;
}

/**
 * Switch active wallet
 * @param {string} walletId 
 * @param {string} password 
 */
async function setActiveWallet(walletId, password) {
  if (!vaultCache) throw new Error('Vault is locked');
  
  // Verify password again for sensitive operation
  const testVault = await loadWalletVault(password);
  if (!testVault) throw new Error('Password verification failed');

  vaultCache.wallets.forEach(w => {
    w.isActive = (w.id === walletId);
  });

  await saveWalletVault(vaultCache, password);
}

/**
 * Rename wallet
 * @param {string} walletId 
 * @param {string} newName 
 * @param {string} password 
 */
async function renameWallet(walletId, newName, password) {
  if (!vaultCache) throw new Error('Vault is locked');
  if (!newName || newName.length < 1) throw new Error('Name is required');

  const wallet = vaultCache.wallets.find(w => w.id === walletId);
  if (!wallet) throw new Error('Wallet not found');

  wallet.name = newName;
  await saveWalletVault(vaultCache, password);
}

/**
 * Delete wallet (DANGER)
 * @param {string} walletId 
 * @param {string} password 
 * @param {string} confirmation - Must type "DELETE"
 */
async function deleteWallet(walletId, password, confirmation) {
  if (!vaultCache) throw new Error('Vault is locked');
  if (confirmation !== 'DELETE') {
    throw new Error('Type DELETE to confirm wallet removal');
  }

  const index = vaultCache.wallets.findIndex(w => w.id === walletId);
  if (index === -1) throw new Error('Wallet not found');

  // Prevent deleting last wallet without warning
  if (vaultCache.wallets.length === 1) {
    throw new Error('Cannot delete the only wallet. Create a new one first or reset app.');
  }

  vaultCache.wallets.splice(index, 1);

  // If deleted was active, set first remaining as active
  if (!vaultCache.wallets.some(w => w.isActive)) {
    vaultCache.wallets[0].isActive = true;
  }

  await saveWalletVault(vaultCache, password);
}

/**
 * Add new account to wallet
 * @param {string} walletId 
 * @param {string} network 
 * @param {string} password 
 */
async function addAccount(walletId, network, password) {
  if (!vaultCache) throw new Error('Vault is locked');

  const wallet = vaultCache.wallets.find(w => w.id === walletId);
  if (!wallet) throw new Error('Wallet not found');

  const nextIndex = wallet.accounts.length;
  
  // We need seed phrase to derive - in real implementation, decrypt from vault
  // For now, this is a placeholder that would use stored encrypted seed
  const newAccount = {
    index: nextIndex,
    network: network,
    address: `0x${generateUUID().replace(/-/g, '').slice(0, 40)}`, // Placeholder
    createdAt: Date.now(),
    label: `Account ${nextIndex + 1}`
  };

  wallet.accounts.push(newAccount);
  await saveWalletVault(vaultCache, password);

  return newAccount;
}

/**
 * Save entire vault
 * @param {object} vault 
 * @param {string} password 
 */
async function saveWalletData(wallet, password) {
  let vault = vaultCache || { wallets: [], version: 1, createdAt: Date.now() };
  
  // If wallet already exists, update it
  const existingIndex = vault.wallets.findIndex(w => w.id === wallet.id);
  if (existingIndex >= 0) {
    vault.wallets[existingIndex] = wallet;
  } else {
    vault.wallets.push(wallet);
  }

  vault.updatedAt = Date.now();
  await saveWalletVault(vault, password);
  vaultCache = vault;
}

/**
 * Derive account from seed (simplified mock)
 * In production, uses BIP32/BIP44 derivation
 * @param {string} walletId 
 * @param {string} seedPhrase 
 * @param {number} index 
 * @param {string} network 
 */
async function deriveAccount(walletId, seedPhrase, index, network) {
  const seed = await mnemonicToSeed(seedPhrase);
  const id = await deterministicId(walletId + seed + index + network);
  
  // Generate mock address based on network
  let address;
  if (network === 'ethereum' || network === 'polygon' || network === 'arbitrum') {
    address = '0x' + id.slice(0, 40);
  } else if (network === 'bitcoin') {
    address = 'bc1q' + id.slice(0, 30);
  } else if (network === 'solana') {
    address = id.slice(0, 32) + 'Sol';
  } else {
    address = id.slice(0, 40);
  }

  return {
    index: index,
    network: network,
    address: address,
    label: index === 0 ? 'Main Account' : `Account ${index + 1}`,
    createdAt: Date.now(),
    balance: '0'
  };
}

/**
 * Quick SHA-256 helper
 * @param {string} data 
 */
async function sha256Quick(data) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Find wallet by seed hash
 * @param {string} seedHash 
 */
async function getWalletBySeedHash(seedHash) {
  if (!vaultCache) return null;
  return vaultCache.wallets.find(w => w.seedHash === seedHash);
}

/**
 * Get all wallets summary
 * @returns {array}
 */
function getWalletsSummary() {
  if (!vaultCache) return [];
  return vaultCache.wallets.map(w => ({
    id: w.id,
    name: w.name,
    isActive: w.isActive,
    accountCount: w.accounts.length,
    accounts: w.accounts.map(a => ({
      index: a.index,
      network: a.network,
      address: a.address,
      label: a.label
    }))
  }));
}

/**
 * Reset everything (NUCLEAR OPTION)
 * @param {string} confirmation 
 */
async function resetAll(confirmation) {
  if (confirmation !== 'RESET EVERYTHING') {
    throw new Error('Type RESET EVERYTHING to confirm complete data wipe');
  }
  
  vaultCache = null;
  vaultPassword = null;
  
  // Clear all storage
  const { clearAll } = await import('./storage-manager.js');
  await clearAll();
}

export {
  initWalletSystem,
  createWallet,
  importWallet,
  unlockVault,
  lockVault,
  isVaultUnlocked,
  getVault,
  getActiveWallet,
  getActiveWalletId,
  setActiveWallet,
  renameWallet,
  deleteWallet,
  addAccount,
  saveWalletData,
  getWalletsSummary,
  resetAll
};
