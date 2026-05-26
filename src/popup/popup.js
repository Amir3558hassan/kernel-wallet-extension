/**
 * KernelWallet Popup Controller
 * Main UI logic for the browser extension popup
 * Handles screens, modals, transactions, and real-time updates
 */

import { 
  initWalletSystem, 
  createWallet, 
  importWallet, 
  unlockVault, 
  lockVault, 
  isVaultUnlocked,
  getActiveWallet,
  getWalletsSummary,
  setActiveWallet,
  addAccount
} from '../core/wallet-manager.js';

import { 
  getAccounts, 
  getActiveAccount, 
  refreshAllBalances, 
  getPortfolioSummary 
} from '../core/account-manager.js';

import { 
  sendTransaction, 
  getReceiveInfo, 
  getHistory, 
  getPendingTransactions 
} from '../core/transaction-manager.js';

import { 
  getAllNetworks, 
  getCurrentNetwork, 
  setCurrentNetwork, 
  getAssetsForNetwork,
  getExplorerUrl 
} from '../core/network-manager.js';

import { 
  validateAddress, 
  shortenAddress, 
  formatCurrency 
} from '../core/crypto-utils.js';

import { 
  isSessionUnlocked, 
  startSession, 
  lockSession 
} from '../security/session-manager.js';

import { checkUrl } from '../security/phishing-detector.js';

// ===== STATE =====
const AppState = {
  screen: 'lock', // lock | welcome | main
  wallet: null,
  account: null,
  network: null,
  balances: [],
  transactions: [],
  pendingTxs: [],
  assets: [],
  isLoading: false,
  sessionTimeout: 10
};

// ===== DOM REFERENCES =====
const Elements = {
  screens: {
    lock: document.getElementById('lock-screen'),
    welcome: document.getElementById('welcome-screen'),
    main: document.getElementById('main-screen')
  },
  
  // Lock screen
  unlockForm: document.getElementById('unlock-form'),
  unlockPassword: document.getElementById('unlock-password'),
  unlockError: document.getElementById('unlock-error'),
  
  // Welcome screen
  btnCreateWallet: document.getElementById('btn-create-wallet'),
  btnImportWallet: document.getElementById('btn-import-wallet'),
  
  // Main screen
  networkBadge: document.getElementById('network-badge'),
  networkDot: document.getElementById('network-dot'),
  networkName: document.getElementById('network-name'),
  btnSettings: document.getElementById('btn-settings'),
  btnLock: document.getElementById('btn-lock'),
  
  accountLabel: document.getElementById('account-label'),
  displayAddress: document.getElementById('display-address'),
  btnCopyAddress: document.getElementById('btn-copy-address'),
  
  totalBalance: document.getElementById('total-balance'),
  balanceChange: document.getElementById('balance-change'),
  
  btnSend: document.getElementById('btn-send'),
  btnReceive: document.getElementById('btn-receive'),
  btnSwap: document.getElementById('btn-swap'),
  btnBuy: document.getElementById('btn-buy'),
  
  assetsList: document.getElementById('assets-list'),
  activityList: document.getElementById('activity-list'),
  
  // Send modal
  sendModal: document.getElementById('send-modal'),
  closeSend: document.getElementById('close-send'),
  sendForm: document.getElementById('send-form'),
  sendAsset: document.getElementById('send-asset'),
  sendAddress: document.getElementById('send-address'),
  sendAmount: document.getElementById('send-amount'),
  btnPaste: document.getElementById('btn-paste'),
  btnQrScan: document.getElementById('btn-qr-scan'),
  btnMax: document.getElementById('btn-max'),
  sendBalance: document.getElementById('send-balance'),
  networkFee: document.getElementById('network-fee'),
  addressValidation: document.getElementById('address-validation'),
  
  // Receive modal
  receiveModal: document.getElementById('receive-modal'),
  closeReceive: document.getElementById('close-receive'),
  receiveQr: document.getElementById('receive-qr'),
  receiveAddress: document.getElementById('receive-address'),
  btnCopyReceive: document.getElementById('btn-copy-receive'),
  receiveAssetName: document.getElementById('receive-asset-name'),
  receiveNetworkName: document.getElementById('receive-network-name'),
  
  // Toast
  toastContainer: document.getElementById('toast-container')
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[KernelWallet] Popup initialized');
  await initializeApp();
});

async function initializeApp() {
  try {
    // Check if wallet exists
    const status = await initWalletSystem();
    
    if (!status.hasWallet) {
      // First time user
      showScreen('welcome');
      setupWelcomeListeners();
    } else if (status.isUnlocked) {
      // Already unlocked (session active)
      await loadMainScreen();
    } else {
      // Locked
      showScreen('lock');
      setupLockListeners();
    }
    
    setupGlobalListeners();
    
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to initialize wallet', 'error');
  }
}

// ===== SCREEN MANAGEMENT =====
function showScreen(screenName) {
  AppState.screen = screenName;
  
  Object.values(Elements.screens).forEach(el => {
    if (el) el.classList.add('hidden');
  });
  
  const target = Elements.screens[screenName];
  if (target) {
    target.classList.remove('hidden');
    // Trigger animation
    target.style.animation = 'none';
    target.offsetHeight; // Force reflow
    target.style.animation = '';
  }
}

// ===== LOCK SCREEN =====
function setupLockListeners() {
  Elements.unlockForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleUnlock();
  });
  
  document.getElementById('forgot-password')?.addEventListener('click', () => {
    showToast('Use your seed phrase to restore wallet', 'info');
  });
  
  document.getElementById('reset-wallet')?.addEventListener('click', () => {
    if (confirm('WARNING: This will delete all wallet data. Make sure you have your seed phrase backed up!')) {
      // Reset logic
      showToast('Reset feature coming soon', 'info');
    }
  });
}

async function handleUnlock() {
  const password = Elements.unlockPassword?.value;
  if (!password) {
    showUnlockError('Please enter your password');
    return;
  }
  
  setLoading(true);
  
  try {
    const result = await unlockVault(password);
    
    if (result.success) {
      // Start session
      await startSession(AppState.sessionTimeout);
      
      // Clear input
      Elements.unlockPassword.value = '';
      Elements.unlockError.classList.add('hidden');
      
      showToast('Wallet unlocked', 'success');
      await loadMainScreen();
    } else {
      showUnlockError('Incorrect password');
    }
  } catch (error) {
    showUnlockError(error.message || 'Unlock failed');
  } finally {
    setLoading(false);
  }
}

function showUnlockError(msg) {
  Elements.unlockError.textContent = msg;
  Elements.unlockError.classList.remove('hidden');
  // Shake animation
  Elements.unlockForm.style.animation = 'shake 0.5s ease';
  setTimeout(() => {
    Elements.unlockForm.style.animation = '';
  }, 500);
}

// ===== WELCOME SCREEN =====
function setupWelcomeListeners() {
  Elements.btnCreateWallet?.addEventListener('click', async () => {
    const password = prompt('Create a secure password (min 8 chars, include uppercase, number, symbol):');
    if (!password) return;
    
    if (password.length < 8) {
      showToast('Password too short', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const result = await createWallet(password, 'My First Wallet', false);
      
      if (result.success) {
        // CRITICAL: Show seed phrase to user ONCE
        alert(`⚠️ WRITE THIS DOWN NOW! ⚠️\n\nYour seed phrase (12 words):\n\n${result.seedPhrase}\n\nThis will NEVER be shown again. Store it safely offline!`);
        
        showToast('Wallet created! Save your seed phrase!', 'success');
        await loadMainScreen();
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  });
  
  Elements.btnImportWallet?.addEventListener('click', async () => {
    const seedPhrase = prompt('Enter your 12 or 24 word seed phrase:');
    if (!seedPhrase) return;
    
    const password = prompt('Create a new password:');
    if (!password) return;
    
    setLoading(true);
    try {
      const result = await importWallet(seedPhrase, password, 'Imported Wallet');
      if (result.success) {
        showToast('Wallet imported successfully', 'success');
        await loadMainScreen();
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  });
}

// ===== MAIN SCREEN =====
async function loadMainScreen() {
  showScreen('main');
  setupMainListeners();
  
  // Load data
  await refreshWalletData();
  
  // Start periodic refresh
  startAutoRefresh();
}

function setupMainListeners() {
  // Lock button
  Elements.btnLock?.addEventListener('click', async () => {
    await lockVault();
    await lockSession();
    showScreen('lock');
    setupLockListeners();
    showToast('Wallet locked', 'info');
  });
  
  // Network switcher
  Elements.networkBadge?.addEventListener('click', showNetworkSelector);
  
  // Copy address
  Elements.btnCopyAddress?.addEventListener('click', () => {
    const address = Elements.displayAddress?.textContent;
    if (address) {
      copyToClipboard(address);
      showToast('Address copied!', 'success');
    }
  });
  
  // Action buttons
  Elements.btnSend?.addEventListener('click', openSendModal);
  Elements.btnReceive?.addEventListener('click', openReceiveModal);
  Elements.btnSwap?.addEventListener('click', () => {
    showToast('Swap feature coming in v2', 'info');
  });
  Elements.btnBuy?.addEventListener('click', () => {
    showToast('Buy feature coming soon', 'info');
  });
  
  // Send modal
  Elements.closeSend?.addEventListener('click', closeSendModal);
  Elements.sendForm?.addEventListener('submit', handleSendSubmit);
  Elements.btnPaste?.addEventListener('click', pasteAddress);
  Elements.btnQrScan?.addEventListener('click', () => {
    showToast('QR scan requires camera permission', 'info');
  });
  Elements.btnMax?.addEventListener('click', setMaxAmount);
  Elements.sendAddress?.addEventListener('input', validateAddressInput);
  Elements.sendAsset?.addEventListener('change', updateSendAssetInfo);
  
  // Receive modal
  Elements.closeReceive?.addEventListener('click', closeReceiveModal);
  Elements.btnCopyReceive?.addEventListener('click', () => {
    const addr = Elements.receiveAddress?.textContent;
    if (addr) {
      copyToClipboard(addr);
      showToast('Address copied!', 'success');
    }
  });
  
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      closeSendModal();
      closeReceiveModal();
    });
  });
  
  // Footer tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tab = btn.dataset.tab;
      handleTabSwitch(tab);
    });
  });
}

async function refreshWalletData() {
  try {
    // Get active wallet and account
    AppState.wallet = getActiveWallet();
    if (!AppState.wallet) {
      showToast('No active wallet found', 'error');
      return;
    }
    
    AppState.network = getCurrentNetwork();
    AppState.account = getActiveAccount(AppState.network.id);
    
    // Update header
    updateHeader();
    
    // Update account card
    updateAccountCard();
    
    // Load and render assets
    await loadAssets();
    
    // Load and render activity
    await loadActivity();
    
  } catch (error) {
    console.error('Refresh error:', error);
    showToast('Failed to load wallet data', 'error');
  }
}

function updateHeader() {
  if (Elements.networkName) {
    Elements.networkName.textContent = AppState.network?.name || 'Ethereum';
  }
  if (Elements.networkDot) {
    const color = AppState.network?.color || '#627EEA';
    Elements.networkDot.style.background = color;
    Elements.networkDot.style.boxShadow = `0 0 6px ${color}80`;
  }
}

function updateAccountCard() {
  if (!AppState.account) return;
  
  if (Elements.accountLabel) {
    Elements.accountLabel.textContent = AppState.account.label || 'Account 1';
  }
  
  if (Elements.displayAddress) {
    Elements.displayAddress.textContent = shortenAddress(AppState.account.address, 6, 4);
  }
  
  // Update balance
  if (Elements.totalBalance) {
    Elements.totalBalance.textContent = formatCurrency(AppState.account.balance || '0', 'USD', 2);
  }
}

async function loadAssets() {
  try {
    // Get assets for current network
    const networkAssets = getAssetsForNetwork(AppState.network.id);
    
    // Get balances
    const accounts = getAccounts();
    const currentAccount = accounts.find(a => a.network === AppState.network.id);
    
    // Clear skeleton
    Elements.assetsList.innerHTML = '';
    
    // Render native currency
    const native = AppState.network.nativeCurrency;
    const nativeBalance = currentAccount?.balance || '0';
    
    renderAssetItem({
      symbol: native,
      name: getAssetName(native),
      balance: nativeBalance,
      value: '$0.00', // Would need price API
      icon: getAssetIcon(native),
      color: AppState.network.color
    });
    
    // Render tokens
    if (currentAccount?.assets) {
      for (const asset of currentAccount.assets) {
        if (asset.error) continue;
        
        const assetConfig = networkAssets.find(a => a.symbol === asset.symbol);
        renderAssetItem({
          symbol: asset.symbol,
          name: assetConfig?.name || asset.symbol,
          balance: asset.balance,
          value: '$0.00',
          icon: getAssetIcon(asset.symbol),
          color: assetConfig?.color || '#6366f1'
        });
      }
    }
    
    // If empty, show empty state
    if (Elements.assetsList.children.length === 0) {
      Elements.assetsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💰</div>
          <p>No assets found</p>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Load assets error:', error);
  }
}

function renderAssetItem(asset) {
  const div = document.createElement('div');
  div.className = 'asset-item';
  div.style.animation = 'fadeIn 0.3s ease';
  
  div.innerHTML = `
    <div class="asset-icon" style="background: linear-gradient(135deg, ${asset.color}40, ${asset.color}20); color: ${asset.color};">
      ${asset.icon}
    </div>
    <div class="asset-info">
      <div class="asset-name">${asset.name}</div>
      <div class="asset-symbol">${asset.symbol}</div>
    </div>
    <div class="asset-balance">
      <div class="asset-amount">${asset.balance}</div>
      <div class="asset-value">${asset.value}</div>
    </div>
  `;
  
  Elements.assetsList.appendChild(div);
}

async function loadActivity() {
  try {
    const history = await getHistory({ 
      network: AppState.network.id,
      limit: 5 
    });
    
    Elements.activityList.innerHTML = '';
    
    if (history.transactions.length === 0) {
      Elements.activityList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>No transactions yet</p>
        </div>
      `;
      return;
    }
    
    for (const tx of history.transactions) {
      renderTransactionItem(tx);
    }
    
  } catch (error) {
    console.error('Load activity error:', error);
  }
}

function renderTransactionItem(tx) {
  const div = document.createElement('div');
  div.className = 'asset-item';
  div.style.cursor = 'pointer';
  div.style.animation = 'fadeIn 0.3s ease';
  
  const isSend = tx.direction === 'outgoing';
  const icon = isSend ? '↑' : '↓';
  const color = isSend ? '#ef4444' : '#22c55e';
  const sign = isSend ? '-' : '+';
  
  div.innerHTML = `
    <div class="asset-icon" style="background: ${color}20; color: ${color};">
      ${icon}
    </div>
    <div class="asset-info">
      <div class="asset-name">${isSend ? 'Sent' : 'Received'} ${tx.asset}</div>
      <div class="asset-symbol">${shortenAddress(tx.to, 4, 4)} • ${formatTime(tx.timestamp)}</div>
    </div>
    <div class="asset-balance">
      <div class="asset-amount" style="color: ${color};">${sign}${tx.amount}</div>
      <div class="asset-value">${tx.status}</div>
    </div>
  `;
  
  div.addEventListener('click', () => {
    if (tx.explorerUrl) {
      window.open(tx.explorerUrl, '_blank');
    }
  });
  
  Elements.activityList.appendChild(div);
}

// ===== NETWORK SELECTOR =====
function showNetworkSelector() {
  const networks = getAllNetworks();
  
  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'network-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    top: 50px;
    left: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md);
    padding: 8px;
    z-index: 100;
    min-width: 200px;
    box-shadow: var(--shadow-md);
    animation: fadeIn 0.2s ease;
  `;
  
  for (const [id, network] of Object.entries(networks)) {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
    `;
    
    const isActive = id === AppState.network?.id;
    if (isActive) {
      item.style.background = 'rgba(99,102,241,0.15)';
    }
    
    item.innerHTML = `
      <span style="width: 10px; height: 10px; border-radius: 50%; background: ${network.color}; box-shadow: 0 0 6px ${network.color}80;"></span>
      <span style="flex: 1; font-weight: 500; font-size: 14px;">${network.name}</span>
      ${isActive ? '<span style="color: var(--accent-primary);">✓</span>' : ''}
    `;
    
    item.addEventListener('click', async () => {
      try {
        setCurrentNetwork(id);
        AppState.network = getCurrentNetwork();
        updateHeader();
        await loadAssets();
        dropdown.remove();
        showToast(`Switched to ${network.name}`, 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
    
    item.addEventListener('mouseenter', () => {
      if (!isActive) item.style.background = 'rgba(255,255,255,0.05)';
    });
    item.addEventListener('mouseleave', () => {
      if (!isActive) item.style.background = 'transparent';
    });
    
    dropdown.appendChild(item);
  }
  
  document.body.appendChild(dropdown);
  
  // Close on click outside
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && !Elements.networkBadge.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', closeDropdown);
  }, 10);
}

// ===== SEND MODAL =====
function openSendModal() {
  if (!AppState.account) {
    showToast('No account available', 'error');
    return;
  }
  
  // Populate asset select
  Elements.sendAsset.innerHTML = '';
  const assets = getAssetsForNetwork(AppState.network.id);
  
  for (const asset of assets) {
    const option = document.createElement('option');
    option.value = asset.symbol;
    option.textContent = `${asset.name} (${asset.symbol})`;
    Elements.sendAsset.appendChild(option);
  }
  
  // Set default to native
  Elements.sendAsset.value = AppState.network.nativeCurrency;
  updateSendAssetInfo();
  
  Elements.sendModal.classList.remove('hidden');
  Elements.sendAddress.focus();
}

function closeSendModal() {
  Elements.sendModal.classList.add('hidden');
  Elements.sendForm.reset();
  Elements.addressValidation.textContent = '';
  Elements.addressValidation.className = 'validation-msg';
}

async function updateSendAssetInfo() {
  const symbol = Elements.sendAsset.value;
  const accounts = getAccounts();
  const account = accounts.find(a => a.network === AppState.network.id);
  
  if (account) {
    let balance = '0';
    if (symbol === AppState.network.nativeCurrency) {
      balance = account.balance || '0';
    } else {
      const asset = (account.assets || []).find(a => a.symbol === symbol);
      balance = asset?.balance || '0';
    }
    
    Elements.sendBalance.textContent = `Balance: ${balance} ${symbol}`;
  }
}

function validateAddressInput() {
  const address = Elements.sendAddress.value.trim();
  const network = AppState.network.id;
  
  if (!address) {
    Elements.addressValidation.textContent = '';
    Elements.addressValidation.className = 'validation-msg';
    return;
  }
  
  const isValid = validateAddress(address, network);
  
  if (isValid) {
    Elements.addressValidation.textContent = '✓ Valid address';
    Elements.addressValidation.className = 'validation-msg valid';
  } else {
    Elements.addressValidation.textContent = '✗ Invalid address for this network';
    Elements.addressValidation.className = 'validation-msg invalid';
  }
}

async function pasteAddress() {
  try {
    const text = await navigator.clipboard.readText();
    Elements.sendAddress.value = text.trim();
    validateAddressInput();
  } catch (error) {
    showToast('Unable to access clipboard', 'error');
  }
}

function setMaxAmount() {
  const symbol = Elements.sendAsset.value;
  const accounts = getAccounts();
  const account = accounts.find(a => a.network === AppState.network.id);
  
  if (account) {
    let balance = '0';
    if (symbol === AppState.network.nativeCurrency) {
      balance = account.balance || '0';
    } else {
      const asset = (account.assets || []).find(a => a.symbol === symbol);
      balance = asset?.balance || '0';
    }
    
    // Leave some for gas (simplified)
    const max = symbol === AppState.network.nativeCurrency 
      ? Math.max(0, parseFloat(balance) - 0.001).toFixed(6)
      : balance;
    
    Elements.sendAmount.value = max;
  }
}

async function handleSendSubmit(e) {
  e.preventDefault();
  
  const to = Elements.sendAddress.value.trim();
  const amount = Elements.sendAmount.value;
  const asset = Elements.sendAsset.value;
  
  if (!to || !amount) {
    showToast('Please fill all fields', 'error');
    return;
  }
  
  if (!validateAddress(to, AppState.network.id)) {
    showToast('Invalid recipient address', 'error');
    return;
  }
  
  // Confirm with user
  const confirmMsg = `Send ${amount} ${asset} to ${shortenAddress(to, 6, 4)} on ${AppState.network.name}?`;
  if (!confirm(confirmMsg)) return;
  
  setLoading(true);
  
  try {
    const password = prompt('Enter your password to confirm:');
    if (!password) {
      setLoading(false);
      return;
    }
    
    const result = await sendTransaction({
      to: to,
      amount: amount,
      asset: asset,
      network: AppState.network.id,
      password: password
    });
    
    if (result.success) {
      showToast(`Transaction sent! Hash: ${shortenAddress(result.transaction.txHash, 6, 4)}`, 'success');
      closeSendModal();
      await loadActivity();
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ===== RECEIVE MODAL =====
function openReceiveModal() {
  if (!AppState.account) {
    showToast('No account available', 'error');
    return;
  }
  
  const info = getReceiveInfo(AppState.network.id, AppState.network.nativeCurrency);
  
  Elements.receiveAddress.textContent = info.address;
  Elements.receiveAssetName.textContent = info.asset;
  Elements.receiveNetworkName.textContent = info.network;
  
  // Generate QR (simplified)
  Elements.receiveQr.textContent = `QR:${info.address.slice(0, 20)}...`;
  
  Elements.receiveModal.classList.remove('hidden');
}

function closeReceiveModal() {
  Elements.receiveModal.classList.add('hidden');
}

// ===== TAB SWITCHING =====
function handleTabSwitch(tab) {
  switch (tab) {
    case 'wallet':
      // Already on wallet
      break;
    case 'browser':
      showToast('Browser tab coming soon', 'info');
      break;
    case 'activity':
      showToast('Full activity view coming soon', 'info');
      break;
    case 'settings':
      showToast('Settings panel coming soon', 'info');
      break;
  }
}

// ===== AUTO REFRESH =====
let refreshInterval = null;

function startAutoRefresh() {
  // Refresh every 30 seconds when popup is open
  refreshInterval = setInterval(async () => {
    if (AppState.screen === 'main' && isVaultUnlocked()) {
      await loadAssets();
      await loadActivity();
    }
  }, 30000);
}

// ===== UTILITIES =====
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  Elements.toastContainer.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

function setLoading(loading) {
  AppState.isLoading = loading;
  
  document.querySelectorAll('.btn').forEach(btn => {
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    
    if (loading) {
      btn.disabled = true;
      text?.classList.add('hidden');
      loader?.classList.remove('hidden');
    } else {
      btn.disabled = false;
      text?.classList.remove('hidden');
      loader?.classList.add('hidden');
    }
  });
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function getAssetName(symbol) {
  const names = {
    'ETH': 'Ethereum',
    'BTC': 'Bitcoin',
    'SOL': 'Solana',
    'USDT': 'Tether USD',
    'XAUt': 'Tether Gold',
    'MATIC': 'Polygon',
    'ARB': 'Arbitrum'
  };
  return names[symbol] || symbol;
}

function getAssetIcon(symbol) {
  const icons = {
    'ETH': 'Ξ',
    'BTC': '₿',
    'SOL': '◎',
    'USDT': '₮',
    'XAUt': '🥇',
    'MATIC': '⬡',
    'ARB': '🔷'
  };
  return icons[symbol] || '◈';
}

function setupGlobalListeners() {
  // Listen for messages from background
  chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
    if (message.kernelwallet && message.type === 'FORCE_LOCK') {
      showScreen('lock');
      setupLockListeners();
      showToast('Session expired - wallet locked', 'info');
    }
    
    if (message.kernelwallet && message.type === 'SESSION_WARNING') {
      showToast(`Session expires in ${message.payload?.secondsRemaining || 0}s`, 'warning');
    }
  });
  
  // Cleanup on close
  window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
}

// Add shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
`;
document.head.appendChild(shakeStyle);

console.log('[KernelWallet] Popup controller loaded');
