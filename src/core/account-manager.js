/**
 * KernelWallet Account Manager
 * Manages accounts within a wallet across multiple networks
 */

import { getActiveWallet, getVault, saveWalletData } from './wallet-manager.js';
import { getBalance } from './wdk-adapter.js';
import { validateAddress } from './crypto-utils.js';
import { getNetwork, getAssetsForNetwork, getNativeCurrency } from './network-manager.js';

/**
 * Get all accounts in active wallet
 * @returns {array}
 */
function getAccounts() {
  const wallet = getActiveWallet();
  if (!wallet) return [];
  return wallet.accounts || [];
}

/**
 * Get accounts for specific network
 * @param {string} networkId 
 * @returns {array}
 */
function getAccountsByNetwork(networkId) {
  const accounts = getAccounts();
  return accounts.filter(a => a.network === networkId);
}

/**
 * Get active account for network (first one or user preference)
 * @param {string} networkId 
 * @returns {object|null}
 */
function getActiveAccount(networkId) {
  const accounts = getAccountsByNetwork(networkId);
  return accounts[0] || null;
}

/**
 * Get account by address
 * @param {string} address 
 * @returns {object|null}
 */
function getAccountByAddress(address) {
  const accounts = getAccounts();
  return accounts.find(a => a.address.toLowerCase() === address.toLowerCase()) || null;
}

/**
 * Get account by index and network
 * @param {number} index 
 * @param {string} network 
 * @returns {object|null}
 */
function getAccount(index, network) {
  const accounts = getAccounts();
  return accounts.find(a => a.index === index && a.network === network) || null;
}

/**
 * Add new account to active wallet
 * @param {string} networkId 
 * @param {string} label 
 * @param {string} password 
 */
async function addNewAccount(networkId, label, password) {
  const wallet = getActiveWallet();
  if (!wallet) throw new Error('No active wallet');

  const network = getNetwork(networkId);
  if (!network) throw new Error('Unknown network');

  const nextIndex = wallet.accounts.length;
  
  // Derive new address (simplified)
  const seed = wallet.id + networkId + nextIndex + Date.now();
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(seed));
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');

  let address;
  if (network.isEVM) {
    address = '0x' + hashHex.slice(0, 40);
  } else if (networkId === 'bitcoin') {
    address = 'bc1q' + hashHex.slice(0, 30);
  } else if (networkId === 'solana') {
    address = hashHex.slice(0, 32);
  } else {
    address = hashHex.slice(0, 40);
  }

  const newAccount = {
    index: nextIndex,
    network: networkId,
    address: address,
    label: label || `Account ${nextIndex + 1}`,
    createdAt: Date.now(),
    balance: '0',
    assets: []
  };

  wallet.accounts.push(newAccount);
  await saveWalletData(wallet, password);

  return newAccount;
}

/**
 * Update account label/name
 * @param {string} address 
 * @param {string} newLabel 
 * @param {string} password 
 */
async function updateAccountLabel(address, newLabel, password) {
  const wallet = getActiveWallet();
  if (!wallet) throw new Error('No active wallet');

  const account = wallet.accounts.find(a => a.address === address);
  if (!account) throw new Error('Account not found');

  account.label = newLabel;
  await saveWalletData(wallet, password);
}

/**
 * Remove account (soft delete - just hides from UI)
 * @param {string} address 
 * @param {string} password 
 */
async function hideAccount(address, password) {
  const wallet = getActiveWallet();
  if (!wallet) throw new Error('No active wallet');

  const account = wallet.accounts.find(a => a.address === address);
  if (!account) throw new Error('Account not found');

  // Prevent hiding last account
  const visibleAccounts = wallet.accounts.filter(a => !a.hidden);
  if (visibleAccounts.length <= 1) {
    throw new Error('Cannot hide the last visible account');
  }

  account.hidden = true;
  await saveWalletData(wallet, password);
}

/**
 * Fetch balances for all accounts
 * @returns {Promise<<array>} Accounts with updated balances
 */
async function refreshAllBalances() {
  const accounts = getAccounts();
  const updated = [];

  for (const account of accounts) {
    if (account.hidden) continue;

    try {
      // Get native balance
      const native = getNativeCurrency(account.network);
      const balanceResult = await getBalance(account.address, account.network, native);
      
      account.balance = balanceResult.balanceFormatted || '0.00';
      account.balanceRaw = balanceResult.balance || '0';
      account.lastUpdated = Date.now();

      // Get token balances for this network
      const assets = getAssetsForNetwork(account.network);
      account.assets = [];
      
      for (const asset of assets) {
        if (asset.isNative) continue; // Already got native balance
        
        try {
          const tokenBalance = await getBalance(account.address, account.network, asset.symbol);
          account.assets.push({
            symbol: asset.symbol,
            name: asset.name,
            balance: tokenBalance.balanceFormatted || '0',
            balanceRaw: tokenBalance.balance || '0',
            decimals: asset.decimals
          });
        } catch (e) {
          // Token might not exist on this account
          account.assets.push({
            symbol: asset.symbol,
            balance: '0',
            error: true
          });
        }
      }

      updated.push(account);
    } catch (error) {
      console.error(`Balance refresh failed for ${account.address}:`, error);
      account.balance = 'Error';
      updated.push(account);
    }
  }

  return updated;
}

/**
 * Get total portfolio value (mock - in production use price API)
 * @returns {Promise<object>}
 */
async function getPortfolioSummary() {
  const accounts = await refreshAllBalances();
  
  let totalAccounts = accounts.length;
  let networksUsed = [...new Set(accounts.map(a => a.network))];
  
  // Calculate total (mock values)
  let totalValue = 0;
  for (const acc of accounts) {
    totalValue += parseFloat(acc.balance || 0);
    for (const asset of (acc.assets || [])) {
      totalValue += parseFloat(asset.balance || 0);
    }
  }

  return {
    totalAccounts,
    networksUsed,
    totalValue: totalValue.toFixed(4),
    currency: 'USD', // Mock
    lastUpdated: Date.now()
  };
}

/**
 * Export account public key (safe to share)
 * @param {string} address 
 * @returns {object}
 */
function exportAccountPublic(address) {
  const account = getAccountByAddress(address);
  if (!account) throw new Error('Account not found');

  return {
    address: account.address,
    network: account.network,
    label: account.label,
    createdAt: account.createdAt
  };
}

export {
  getAccounts,
  getAccountsByNetwork,
  getActiveAccount,
  getAccountByAddress,
  getAccount,
  addNewAccount,
  updateAccountLabel,
  hideAccount,
  refreshAllBalances,
  getPortfolioSummary,
  exportAccountPublic
};
