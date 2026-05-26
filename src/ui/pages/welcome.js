/**
 * KernelWallet Welcome Page Controller
 * First-time user onboarding with wallet creation and import
 */

import { createWallet, importWallet } from '../../core/wallet-manager.js';
import { validatePasswordStrength } from '../../security/password-lock.js';
import { validateSeedPhrase } from '../../security/seed-phrase.js';

// ===== DOM REFERENCES =====
const Elements = {
  btnCreate: document.getElementById('btn-create'),
  btnImport: document.getElementById('btn-import'),
  
  // Create modal
  createModal: document.getElementById('create-modal'),
  closeCreate: document.getElementById('close-create'),
  createForm: document.getElementById('create-form'),
  walletName: document.getElementById('wallet-name'),
  createPassword: document.getElementById('create-password'),
  toggleCreatePw: document.getElementById('toggle-create-pw'),
  confirmPassword: document.getElementById('confirm-password'),
  termsCheck: document.getElementById('terms-check'),
  submitCreate: document.getElementById('submit-create'),
  submitText: document.querySelector('#submit-create .submit-text'),
  submitLoader: document.querySelector('#submit-create .submit-loader'),
  
  // Strength meter
  meterFill: document.getElementById('meter-fill'),
  meterLabel: document.getElementById('meter-label'),
  
  // Import modal
  importModal: document.getElementById('import-modal'),
  closeImport: document.getElementById('close-import'),
  importForm: document.getElementById('import-form'),
  importSeed: document.getElementById('import-seed'),
  importPassword: document.getElementById('import-password'),
  submitImport: document.getElementById('submit-import'),
  wordCount: document.getElementById('word-count'),
  
  // Seed backup modal
  seedModal: document.getElementById('seed-modal'),
  seedGrid: document.getElementById('seed-grid'),
  btnCopySeed: document.getElementById('btn-copy-seed'),
  btnSavedSeed: document.getElementById('btn-saved-seed')
};

let generatedSeedPhrase = null;
let generatedWalletData = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  initializeWelcomePage();
});

function initializeWelcomePage() {
  setupEventListeners();
  animateEntrance();
}

function animateEntrance() {
  // Staggered animation for elements
  const elements = document.querySelectorAll('.brand-logo, .main-title, .tagline, .features, .action-area, .security-note');
  elements.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    setTimeout(() => {
      el.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 100 + i * 100);
  });
}

function setupEventListeners() {
  // Main buttons
  Elements.btnCreate?.addEventListener('click', openCreateModal);
  Elements.btnImport?.addEventListener('click', openImportModal);
  
  // Create modal
  Elements.closeCreate?.addEventListener('click', closeCreateModal);
  Elements.createForm?.addEventListener('submit', handleCreateWallet);
  Elements.createPassword?.addEventListener('input', updatePasswordMeter);
  Elements.toggleCreatePw?.addEventListener('click', () => togglePasswordVisibility(
    Elements.createPassword, Elements.toggleCreatePw
  ));
  
  // Import modal
  Elements.closeImport?.addEventListener('click', closeImportModal);
  Elements.importForm?.addEventListener('submit', handleImportWallet);
  Elements.importSeed?.addEventListener('input', updateWordCount);
  
  // Seed backup
  Elements.btnCopySeed?.addEventListener('click', copySeedPhrase);
  Elements.btnSavedSeed?.addEventListener('click', confirmSeedSaved);
  
  // Close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      closeCreateModal();
      closeImportModal();
    });
  });
  
  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCreateModal();
      closeImportModal();
      closeSeedModal();
    }
  });
}

// ===== MODAL MANAGEMENT =====
function openCreateModal() {
  Elements.createModal?.classList.remove('hidden');
  Elements.walletName?.focus();
  document.body.style.overflow = 'hidden';
}

function closeCreateModal() {
  Elements.createModal?.classList.add('hidden');
  Elements.createForm?.reset();
  resetPasswordMeter();
  document.body.style.overflow = '';
}

function openImportModal() {
  Elements.importModal?.classList.remove('hidden');
  Elements.importSeed?.focus();
  document.body.style.overflow = 'hidden';
}

function closeImportModal() {
  Elements.importModal?.classList.add('hidden');
  Elements.importForm?.reset();
  updateWordCount();
  document.body.style.overflow = '';
}

function openSeedModal() {
  Elements.seedModal?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSeedModal() {
  Elements.seedModal?.classList.add('hidden');
  generatedSeedPhrase = null;
  generatedWalletData = null;
  document.body.style.overflow = '';
}

// ===== PASSWORD STRENGTH METER =====
function updatePasswordMeter() {
  const password = Elements.createPassword?.value || '';
  
  if (!password) {
    resetPasswordMeter();
    return;
  }
  
  let strength = 0;
  const checks = [
    password.length >= 8,
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  
  strength = checks.filter(Boolean).length;
  
  const percentage = (strength / 6) * 100;
  const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#22c55e', '#22c55e'];
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  
  if (Elements.meterFill) {
    Elements.meterFill.style.width = `${percentage}%`;
    Elements.meterFill.style.background = colors[Math.max(0, strength - 1)] || '#ef4444';
  }
  
  if (Elements.meterLabel) {
    Elements.meterLabel.textContent = labels[Math.max(0, strength - 1)] || 'Very Weak';
    Elements.meterLabel.style.color = colors[Math.max(0, strength - 1)] || '#ef4444';
  }
}

function resetPasswordMeter() {
  if (Elements.meterFill) {
    Elements.meterFill.style.width = '0%';
  }
  if (Elements.meterLabel) {
    Elements.meterLabel.textContent = '';
  }
}

function togglePasswordVisibility(input, toggleBtn) {
  if (!input || !toggleBtn) return;
  
  if (input.type === 'password') {
    input.type = 'text';
    toggleBtn.textContent = '🙈';
  } else {
    input.type = 'password';
    toggleBtn.textContent = '👁️';
  }
}

// ===== CREATE WALLET =====
async function handleCreateWallet(e) {
  e.preventDefault();
  
  const name = Elements.walletName?.value?.trim() || 'My Wallet';
  const password = Elements.createPassword?.value;
  const confirmPw = Elements.confirmPassword?.value;
  
  // Validation
  if (!password || password.length < 8) {
    alert('Password must be at least 8 characters');
    return;
  }
  
  if (password !== confirmPw) {
    alert('Passwords do not match');
    return;
  }
  
  if (!Elements.termsCheck?.checked) {
    alert('Please confirm you understand the importance of your seed phrase');
    return;
  }
  
  setLoading(true, 'create');
  
  try {
    const result = await createWallet(password, name, false);
    
    if (result.success) {
      generatedSeedPhrase = result.seedPhrase;
      generatedWalletData = result.wallet;
      
      // Hide create modal, show seed backup
      closeCreateModal();
      showSeedBackup();
    }
  } catch (error) {
    alert('Failed to create wallet: ' + error.message);
  } finally {
    setLoading(false, 'create');
  }
}

function showSeedBackup() {
  if (!generatedSeedPhrase) return;
  
  // Render seed words
  Elements.seedGrid.innerHTML = '';
  const words = generatedSeedPhrase.split(' ');
  
  words.forEach((word, index) => {
    const wordEl = document.createElement('div');
    wordEl.className = 'seed-word';
    wordEl.innerHTML = `
      <span class="word-num">${index + 1}.</span>
      <span class="word-text">${word}</span>
    `;
    
    // Staggered animation
    wordEl.style.opacity = '0';
    wordEl.style.transform = 'translateY(10px)';
    setTimeout(() => {
      wordEl.style.transition = 'all 0.3s ease';
      wordEl.style.opacity = '1';
      wordEl.style.transform = 'translateY(0)';
    }, index * 50);
    
    Elements.seedGrid.appendChild(wordEl);
  });
  
  openSeedModal();
}

function copySeedPhrase() {
  if (!generatedSeedPhrase) return;
  
  navigator.clipboard.writeText(generatedSeedPhrase).then(() => {
    Elements.btnCopySeed.textContent = '✓ Copied!';
    Elements.btnCopySeed.style.background = 'rgba(34, 197, 94, 0.2)';
    Elements.btnCopySeed.style.borderColor = 'rgba(34, 197, 94, 0.3)';
    
    setTimeout(() => {
      Elements.btnCopySeed.textContent = '📋 Copy (Not Recommended)';
      Elements.btnCopySeed.style.background = '';
      Elements.btnCopySeed.style.borderColor = '';
    }, 3000);
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = generatedSeedPhrase;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  });
}

function confirmSeedSaved() {
  // CRITICAL: Verify user has saved seed phrase
  const confirmCount = Math.floor(Math.random() * 12) + 1;
  const userInput = prompt(
    `SECURITY VERIFICATION\n\n` +
    `To confirm you've saved your seed phrase, please enter word #${confirmCount}:\n\n` +
    `(This is word number ${confirmCount} from your 12-word phrase)`
  );
  
  if (!userInput) return; // Cancelled
  
  const words = generatedSeedPhrase.split(' ');
  if (userInput.trim().toLowerCase() === words[confirmCount - 1].toLowerCase()) {
    // Success! Redirect to main wallet
    alert('✓ Verification passed! Your wallet is ready.\n\nRemember: NEVER share your seed phrase with anyone!');
    window.location.href = '../../popup/popup.html';
  } else {
    alert('✗ Incorrect word. Please write down ALL 12 words in order and try again.\n\nYour seed phrase is the ONLY way to recover your wallet!');
    // Keep modal open
  }
}

// ===== IMPORT WALLET =====
async function handleImportWallet(e) {
  e.preventDefault();
  
  const seedPhrase = Elements.importSeed?.value?.trim();
  const password = Elements.importPassword?.value;
  
  if (!seedPhrase) {
    alert('Please enter your seed phrase');
    return;
  }
  
  // Validate word count
  const words = seedPhrase.split(/\s+/).filter(w => w.length > 0);
  if (words.length !== 12 && words.length !== 24) {
    alert(`Seed phrase must be 12 or 24 words. You entered ${words.length} words.`);
    return;
  }
  
  // Validate phrase format
  if (!validateSeedPhrase(seedPhrase)) {
    alert('Invalid seed phrase. Please check your words and try again.');
    return;
  }
  
  if (!password || password.length < 8) {
    alert('Password must be at least 8 characters');
    return;
  }
  
  setLoading(true, 'import');
  
  try {
    const result = await importWallet(seedPhrase, password, 'Imported Wallet');
    
    if (result.success) {
      alert('✓ Wallet imported successfully!\n\nYour wallet is now ready to use.');
      window.location.href = '../../popup/popup.html';
    }
  } catch (error) {
    alert('Import failed: ' + error.message);
  } finally {
    setLoading(false, 'import');
  }
}

function updateWordCount() {
  const text = Elements.importSeed?.value?.trim() || '';
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  if (Elements.wordCount) {
    Elements.wordCount.textContent = `${words.length} words`;
    
    if (words.length === 12 || words.length === 24) {
      Elements.wordCount.style.color = '#22c55e';
    } else if (words.length > 0) {
      Elements.wordCount.style.color = '#f59e0b';
    } else {
      Elements.wordCount.style.color = 'var(--text-dim)';
    }
  }
}

// ===== UI HELPERS =====
function setLoading(loading, type) {
  const isCreate = type === 'create';
  const btn = isCreate ? Elements.submitCreate : Elements.submitImport;
  const loader = isCreate ? Elements.submitLoader : null;
  
  if (btn) {
    btn.disabled = loading;
    
    if (isCreate && Elements.submitText && loader) {
      if (loading) {
        Elements.submitText.classList.add('hidden');
        loader.classList.remove('hidden');
      } else {
        Elements.submitText.classList.remove('hidden');
        loader.classList.add('hidden');
      }
    }
  }
}

console.log('[KernelWallet] Welcome page loaded');
