/**
 * KernelWallet Transaction Manager
 * Handles send, receive, history, filtering, and status monitoring
 */

import { sendCrypto, getTransactionHistory as fetchHistory } from './wdk-adapter.js';
import { saveTransactions, loadTransactions } from './storage-manager.js';
import { getActiveAccount, getAccountByAddress } from './account-manager.js';
import { validateAddress, shortenAddress, formatCurrency } from './crypto-utils.js';
import { getNetwork, getTxExplorerUrl, getAsset } from './network-manager.js';
import { isSessionUnlocked } from '../security/session-manager.js';

// In-memory pending transactions queue
const pendingTxs = new Map();

/**
 * Transaction structure:
 * {
 *   id: string,
 *   type: 'send' | 'receive',
 *   from: address,
 *   to: address,
 *   amount: string,
 *   asset: symbol,
 *   network: networkId,
 *   fee: string,
 *   status: 'pending' | 'confirmed' | 'failed',
 *   txHash: string,
 *   timestamp: number,
 *   confirmations: number,
 *   note: string,
 *   direction: 'outgoing' | 'incoming'
 * }
 */

/**
 * Send cryptocurrency
 * @param {object} params 
 * @returns {Promise<object>}
 */
async function sendTransaction(params) {
  const { to, amount, asset, network, note, password } = params;
  
  // Security checks
  if (!isSessionUnlocked()) {
    throw new Error('Wallet is locked. Please unlock first.');
  }

  if (!password) {
    throw new Error('Password required for transaction signing');
  }

  // Validate inputs
  if (!to || !amount || !asset || !network) {
    throw new Error('Missing required fields: to, amount, asset, network');
  }

  if (parseFloat(amount) <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const networkConfig = getNetwork(network);
  if (!networkConfig) {
    throw new Error('Invalid network');
  }

  if (!validateAddress(to, network)) {
    throw new Error(`Invalid recipient address for ${network}`);
  }

  // Get sender account
  const sender = getActiveAccount(network);
  if (!sender) {
    throw new Error(`No active account found for ${network}`);
  }

  // Check if sending to self
  if (sender.address.toLowerCase() === to.toLowerCase()) {
    throw new Error('Cannot send to yourself');
  }

  // Create transaction record
  const txId = crypto.randomUUID();
  const txRecord = {
    id: txId,
    type: 'send',
    direction: 'outgoing',
    from: sender.address,
    to: to,
    amount: amount,
    asset: asset,
    network: network,
    fee: '0', // Will be updated
    status: 'pending',
    txHash: null,
    timestamp: Date.now(),
    confirmations: 0,
    note: note || '',
    explorerUrl: null
  };

  try {
    // Execute via WDK adapter
    const result = await sendCrypto({
      from: sender.address,
      to: to,
      amount: amount,
      network: network,
      asset: asset,
      password: password
    });

    // Update record with result
    txRecord.txHash = result.txHash;
    txRecord.status = 'pending';
    txRecord.explorerUrl = getTxExplorerUrl(result.txHash, network);
    
    // Save to history
    await addToHistory(txRecord);
    
    // Track pending
    pendingTxs.set(txId, txRecord);
    monitorTransaction(txId, network);

    return {
      success: true,
      transaction: txRecord,
      message: 'Transaction submitted successfully'
    };

  } catch (error) {
    txRecord.status = 'failed';
    txRecord.error = error.message;
    await addToHistory(txRecord);
    
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

/**
 * Generate receive QR and address
 * @param {string} network 
 * @param {string} asset 
 * @returns {object}
 */
function getReceiveInfo(network, asset) {
  const account = getActiveAccount(network);
  if (!account) {
    throw new Error(`No account available for ${network}`);
  }

  const assetConfig = getAsset(asset);
  
  return {
    address: account.address,
    network: network,
    asset: asset,
    label: account.label,
    qrData: `${asset.toLowerCase()}:${account.address}?asset=${asset}`,
    warning: `Only send ${asset} on ${network} to this address. Sending other assets may result in permanent loss.`
  };
}

/**
 * Add transaction to local history
 * @param {object} tx 
 */
async function addToHistory(tx) {
  const history = await loadTransactions();
  history.unshift(tx); // Add to beginning
  
  // Keep only last 1000 transactions
  if (history.length > 1000) {
    history.length = 1000;
  }
  
  await saveTransactions(history);
}

/**
 * Get transaction history with filtering
 * @param {object} filters 
 * @returns {Promise<<array>}
 */
async function getHistory(filters = {}) {
  const history = await loadTransactions();
  
  let filtered = history;
  
  // Filter by network
  if (filters.network) {
    filtered = filtered.filter(tx => tx.network === filters.network);
  }
  
  // Filter by asset
  if (filters.asset) {
    filtered = filtered.filter(tx => tx.asset === filters.asset);
  }
  
  // Filter by type
  if (filters.type) {
    filtered = filtered.filter(tx => tx.type === filters.type);
  }
  
  // Filter by status
  if (filters.status) {
    filtered = filtered.filter(tx => tx.status === filters.status);
  }
  
  // Filter by date range
  if (filters.startDate) {
    filtered = filtered.filter(tx => tx.timestamp >= filters.startDate);
  }
  if (filters.endDate) {
    filtered = filtered.filter(tx => tx.timestamp <= filters.endDate);
  }
  
  // Filter by search term (address or txHash)
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(tx => 
      tx.to.toLowerCase().includes(search) ||
      tx.from.toLowerCase().includes(search) ||
      (tx.txHash && tx.txHash.toLowerCase().includes(search)) ||
      (tx.note && tx.note.toLowerCase().includes(search))
    );
  }
  
  // Sort by timestamp (newest first)
  filtered.sort((a, b) => b.timestamp - a.timestamp);
  
  // Pagination
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);
  
  return {
    transactions: paginated,
    total: filtered.length,
    page: page,
    totalPages: Math.ceil(filtered.length / limit),
    filters: filters
  };
}

/**
 * Get transaction by ID
 * @param {string} txId 
 * @returns {Promise<object|null>}
 */
async function getTransaction(txId) {
  const history = await loadTransactions();
  return history.find(tx => tx.id === txId) || null;
}

/**
 * Get pending transactions
 * @returns {array}
 */
function getPendingTransactions() {
  return Array.from(pendingTxs.values());
}

/**
 * Monitor pending transaction status
 * @param {string} txId 
 * @param {string} network 
 */
async function monitorTransaction(txId, network) {
  const maxAttempts = 60; // Monitor for ~10 minutes
  let attempts = 0;
  
  const interval = setInterval(async () => {
    attempts++;
    
    const tx = pendingTxs.get(txId);
    if (!tx) {
      clearInterval(interval);
      return;
    }
    
    try {
      // In production, query blockchain for confirmation
      // Mock: auto-confirm after random time
      if (attempts > 5 && Math.random() > 0.3) {
        tx.status = 'confirmed';
        tx.confirmations = Math.floor(Math.random() * 20) + 1;
        pendingTxs.delete(txId);
        
        // Update history
        const history = await loadTransactions();
        const idx = history.findIndex(t => t.id === txId);
        if (idx >= 0) {
          history[idx] = tx;
          await saveTransactions(history);
        }
        
        clearInterval(interval);
        
        // Notify user (in real app, show notification)
        console.log(`Transaction confirmed: ${tx.txHash}`);
      }
      
      if (attempts >= maxAttempts) {
        tx.status = 'failed';
        tx.error = 'Timeout waiting for confirmation';
        pendingTxs.delete(txId);
        clearInterval(interval);
      }
    } catch (error) {
      console.error('Monitor error:', error);
    }
  }, 10000); // Check every 10 seconds
}

/**
 * Cancel/stop monitoring a transaction (if still pending)
 * @param {string} txId 
 */
function cancelMonitoring(txId) {
  pendingTxs.delete(txId);
}

/**
 * Get transaction statistics
 * @returns {Promise<object>}
 */
async function getTransactionStats() {
  const history = await loadTransactions();
  
  const total = history.length;
  const sent = history.filter(tx => tx.direction === 'outgoing').length;
  const received = history.filter(tx => tx.direction === 'incoming').length;
  const pending = history.filter(tx => tx.status === 'pending').length;
  const confirmed = history.filter(tx => tx.status === 'confirmed').length;
  const failed = history.filter(tx => tx.status === 'failed').length;
  
  // Calculate total sent amount (mock - needs price data)
  let totalSent = 0;
  for (const tx of history) {
    if (tx.direction === 'outgoing' && tx.status === 'confirmed') {
      totalSent += parseFloat(tx.amount || 0);
    }
  }
  
  return {
    total,
    sent,
    received,
    pending,
    confirmed,
    failed,
    totalSent: totalSent.toFixed(6),
    lastTransaction: history[0] || null
  };
}

/**
 * Add note to existing transaction
 * @param {string} txId 
 * @param {string} note 
 */
async function addTransactionNote(txId, note) {
  const history = await loadTransactions();
  const tx = history.find(t => t.id === txId);
  if (!tx) throw new Error('Transaction not found');
  
  tx.note = note;
  await saveTransactions(history);
  return tx;
}

export {
  sendTransaction,
  getReceiveInfo,
  getHistory,
  getTransaction,
  getPendingTransactions,
  monitorTransaction,
  cancelMonitoring,
  getTransactionStats,
  addTransactionNote,
  addToHistory
};
