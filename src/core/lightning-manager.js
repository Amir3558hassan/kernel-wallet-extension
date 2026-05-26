/**
 * KernelWallet Lightning Network Manager
 * Handles Lightning (Spark) invoices, payments, and channel info
 * 
 * NOTE: Lightning requires special handling as it's L2 on Bitcoin
 */

import { getActiveAccount } from './account-manager.js';
import { getNetwork } from './network-manager.js';
import { generateUUID, randomHex } from './crypto-utils.js';

// Mock Spark/Lightning integration
// In production, connects to Lightning node or Spark API

const LIGHTNING_CONFIG = {
  minPayment: 1,        // 1 satoshi
  maxPayment: 10000000, // 0.1 BTC
  expirySeconds: 3600   // 1 hour default invoice expiry
};

/**
 * Generate Lightning invoice (receive)
 * @param {number} amountSats - Amount in satoshis
 * @param {string} memo - Description
 * @param {number} expiry - Expiry in seconds
 * @returns {Promise<object>} Invoice data
 */
async function createInvoice(amountSats, memo = '', expiry = LIGHTNING_CONFIG.expirySeconds) {
  if (amountSats < LIGHTNING_CONFIG.minPayment) {
    throw new Error(`Minimum amount is ${LIGHTNING_CONFIG.minPayment} satoshi`);
  }
  if (amountSats > LIGHTNING_CONFIG.maxPayment) {
    throw new Error(`Maximum amount is ${LIGHTNING_CONFIG.maxPayment} satoshi`);
  }

  const account = getActiveAccount('lightning');
  if (!account) {
    throw new Error('No Lightning account found');
  }

  // Generate invoice ID
  const invoiceId = 'ln' + randomHex(16);
  
  // Mock BOLT11 invoice string
  // In production, this comes from Lightning node
  const bolt11 = generateMockBolt11(invoiceId, amountSats, memo, expiry);

  const invoice = {
    id: invoiceId,
    type: 'invoice',
    bolt11: bolt11,
    amount: amountSats,
    amountBtc: (amountSats / 1e8).toFixed(8),
    memo: memo,
    status: 'unpaid', // unpaid | paid | expired
    createdAt: Date.now(),
    expiresAt: Date.now() + (expiry * 1000),
    paymentHash: randomHex(32),
    receiveAddress: account.address,
    qrData: bolt11
  };

  // Save to pending invoices
  await savePendingInvoice(invoice);

  return {
    success: true,
    invoice: invoice,
    message: 'Invoice created. Share the QR code or BOLT11 string to receive payment.'
  };
}

/**
 * Pay Lightning invoice
 * @param {string} bolt11 - BOLT11 invoice string
 * @param {string} password - Wallet password
 * @returns {Promise<object>} Payment result
 */
async function payInvoice(bolt11, password) {
  if (!bolt11 || !bolt11.startsWith('ln')) {
    throw new Error('Invalid Lightning invoice');
  }

  // Parse invoice (simplified)
  const decoded = decodeBolt11(bolt11);
  if (!decoded) {
    throw new Error('Could not decode invoice');
  }

  if (decoded.expiresAt < Date.now()) {
    throw new Error('Invoice has expired');
  }

  const account = getActiveAccount('lightning');
  if (!account) {
    throw new Error('No Lightning account found');
  }

  // Check balance (mock)
  const balanceSats = parseFloat(account.balance || 0) * 1e8;
  if (balanceSats < decoded.amount) {
    throw new Error('Insufficient Lightning balance');
  }

  // Execute payment (mock)
  const paymentId = generateUUID();
  const payment = {
    id: paymentId,
    type: 'payment',
    direction: 'outgoing',
    bolt11: bolt11,
    amount: decoded.amount,
    amountBtc: (decoded.amount / 1e8).toFixed(8),
    memo: decoded.memo,
    status: 'pending',
    paymentHash: decoded.paymentHash,
    preimage: null, // Filled on success
    from: account.address,
    timestamp: Date.now(),
    fee: Math.ceil(decoded.amount * 0.001) // 0.1% fee mock
  };

  // Simulate payment processing
  await processLightningPayment(payment);

  return {
    success: true,
    payment: payment,
    message: 'Lightning payment sent successfully'
  };
}

/**
 * Decode BOLT11 invoice (simplified mock)
 * In production, use proper BOLT11 decoder library
 * @param {string} bolt11 
 * @returns {object|null}
 */
function decodeBolt11(bolt11) {
  try {
    // Mock decoder - real implementation uses bech32 decoding
    const parts = bolt11.split('1');
    if (parts.length < 2) return null;

    // Extract amount (mock)
    const amountMatch = bolt11.match(/ln(\d+)/);
    const amount = amountMatch ? parseInt(amountMatch[1]) : 0;

    return {
      amount: amount,
      paymentHash: randomHex(32),
      memo: 'Lightning payment',
      expiresAt: Date.now() + 3600000,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('BOLT11 decode error:', error);
    return null;
  }
}

/**
 * Generate mock BOLT11 string
 * @param {string} id 
 * @param {number} amountSats 
 * @param {string} memo 
 * @param {number} expiry 
 * @returns {string}
 */
function generateMockBolt11(id, amountSats, memo, expiry) {
  const prefix = amountSats > 0 ? `ln${amountSats}` : 'lnbc';
  const hash = randomHex(20);
  return `${prefix}1${id}${hash}...mock_bolt11_invoice`;
}

/**
 * Process Lightning payment (mock async)
 * @param {object} payment 
 */
async function processLightningPayment(payment) {
  // In production, this connects to Lightning node API
  // Mock: resolve immediately with success
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  payment.status = 'success';
  payment.preimage = randomHex(32);
  payment.settledAt = Date.now();
}

/**
 * Get Lightning balance and channel info
 * @returns {Promise<object>}
 */
async function getLightningInfo() {
  const account = getActiveAccount('lightning');
  if (!account) {
    return {
      hasAccount: false,
      balance: 0,
      channels: [],
      pendingPayments: []
    };
  }

  // Mock channel data
  const channels = [
    {
      id: 'chan_' + randomHex(8),
      capacity: 1000000, // sats
      localBalance: 750000,
      remoteBalance: 250000,
      status: 'active',
      peer: 'SparkNode_' + randomHex(6)
    }
  ];

  return {
    hasAccount: true,
    address: account.address,
    balance: account.balance || '0',
    balanceSats: parseFloat(account.balance || 0) * 1e8,
    channels: channels,
    pendingPayments: [], // Would track pending
    network: 'lightning'
  };
}

/**
 * Check if invoice is paid
 * @param {string} invoiceId 
 * @returns {Promise<object>}
 */
async function checkInvoiceStatus(invoiceId) {
  // In production, query Lightning node
  // Mock: random status
  const statuses = ['unpaid', 'paid', 'expired'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    id: invoiceId,
    status: randomStatus,
    checkedAt: Date.now()
  };
}

/**
 * Save pending invoice to storage
 * @param {object} invoice 
 */
async function savePendingInvoice(invoice) {
  const { getItem, setItem } = await import('./storage-manager.js');
  const pending = await getItem('lightning_pending_invoices') || [];
  pending.push(invoice);
  await setItem('lightning_pending_invoices', pending, false);
}

/**
 * Get all pending invoices
 * @returns {Promise<<array>}
 */
async function getPendingInvoices() {
  const { getItem } = await import('./storage-manager.js');
  const pending = await getItem('lightning_pending_invoices') || [];
  return pending.filter(inv => inv.expiresAt > Date.now());
}

/**
 * Open new Lightning channel (advanced)
 * @param {string} peerPubkey 
 * @param {number} capacitySats 
 * @returns {Promise<object>}
 */
async function openChannel(peerPubkey, capacitySats) {
  // Advanced feature - requires Lightning node connection
  return {
    success: true,
    message: 'Channel opening initiated',
    channelId: 'chan_' + randomHex(8),
    capacity: capacitySats,
    peer: peerPubkey
  };
}

/**
 * Close Lightning channel
 * @param {string} channelId 
 * @returns {Promise<object>}
 */
async function closeChannel(channelId) {
  return {
    success: true,
    message: 'Channel closing initiated',
    channelId: channelId
  };
}

export {
  createInvoice,
  payInvoice,
  decodeBolt11,
  getLightningInfo,
  checkInvoiceStatus,
  getPendingInvoices,
  openChannel,
  closeChannel,
  LIGHTNING_CONFIG
};
