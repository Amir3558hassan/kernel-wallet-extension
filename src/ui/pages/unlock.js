/**
 * KernelWallet Unlock Page Controller
 * Standalone unlock page for session restoration
 */

import { unlockVault, isVaultUnlocked } from '../../core/wallet-manager.js';
import { startSession } from '../../security/session-manager.js';
import { validatePasswordStrength } from '../../security/password-lock.js';
import { importWallet } from '../../core/wallet-manager.js';

// ===== DOM REFERENCES =====
const Elements = {
  form: document.getElementById('unlock-form'),
  passwordInput: document.getElementById('password-input'),
  togglePassword: document.getElementById('toggle-password'),
  unlockBtn: document.getElementById('unlock-btn'),
  btnLoader: document.getElementById('btn-loader'),
  errorBox: document.getElementById('error-box'),
  errorText: document.getElementById('error-text'),
  strengthBar: document.getElementById('password-strength'),
  strengthFill: document.getElementById('strength-fill'),
  strengthText: document.getElementById('strength-text'),
  timeoutDisplay: document.getElementById('timeout-display'),
  
  // Footer
  btnForgot: document.getElementById('btn-forgot'),
  btnRestore: document.getElementById('btn-restore'),
  
  // Modal
  restoreModal: document.getElementById('restore-modal'),
  closeRestore: document.getElementById('close-restore'),
  seedInput: document.getElementById('seed-input'),
  newPassword: document.getElementById('new-password'),
  btnConfirmRestore: document.getElementById('btn-confirm-restore'),
  seedValidation: document.getElementById('seed-validation'),
  
  // Background
  bgParticles: document.getElementById('bg-particles')
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  initializeUnlockPage();
});

function initializeUnlockPage() {
  // Create background particles
  createParticles();
  
  // Focus password input
  Elements.passwordInput?.focus();
  
  // Setup listeners
  setupListeners();
  
  // Load settings
  loadSettings();
}

function createParticles() {
  const container = Elements.bgParticles;
  if (!container) return;
  
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * 8}s`;
    particle.style.animationDuration = `${6 + Math.random() * 6}s`;
    
    // Random size
    const size = 1 + Math.random() * 3;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    
    container.appendChild(particle);
  }
}

function setupListeners() {
  // Form submit
  Elements.form?.addEventListener('submit', handleUnlock);
  
  // Toggle password visibility
  Elements.togglePassword?.addEventListener('click', togglePasswordVisibility);
  
  // Password strength meter (for new password scenarios)
  Elements.passwordInput?.addEventListener('input', updatePasswordStrength);
  
  // Footer links
  Elements.btnForgot?.addEventListener('click', () => {
    alert('If you forgot your password, you must restore your wallet using your seed phrase.\n\nYour seed phrase is the only way to recover your funds.');
  });
  
  Elements.btnRestore?.addEventListener('click', openRestoreModal);
  
  // Modal
  Elements.closeRestore?.addEventListener('click', closeRestoreModal);
  Elements.btnConfirmRestore?.addEventListener('click', handleRestore);
  Elements.seedInput?.addEventListener('input', validateSeedInput);
  
  // Enter key in modal
  Elements.newPassword?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleRestore();
  });
  
  // Close modal on backdrop click
  document.querySelector('.modal-backdrop')?.addEventListener('click', closeRestoreModal);
}

function loadSettings() {
  // Load session timeout from storage
  chrome.storage?.local?.get('kw_settings')?.then(result => {
    const timeout = result.kw_settings?.sessionTimeout || 10;
    if (Elements.timeoutDisplay) {
      Elements.timeoutDisplay.textContent = timeout;
    }
  }).catch(() => {
    // Default
    if (Elements.timeoutDisplay) {
      Elements.timeoutDisplay.textContent = '10';
    }
  });
}

// ===== UNLOCK LOGIC =====
async function handleUnlock(e) {
  e.preventDefault();
  
  const password = Elements.passwordInput?.value;
  if (!password) {
    showError('Please enter your password');
    return;
  }
  
  setLoading(true);
  hideError();
  
  try {
    const result = await unlockVault(password);
    
    if (result.success) {
      // Start session
      await startSession(10); // 10 minutes default
      
      // Notify background
      chrome.runtime?.sendMessage?.({
        action: 'vault_unlocked',
        timestamp: Date.now()
      });
      
      // Redirect to popup or close
      window.location.href = '../../popup/popup.html';
    } else {
      showError('Incorrect password. Please try again.');
    }
  } catch (error) {
    showError(error.message || 'Failed to unlock wallet');
  } finally {
    setLoading(false);
  }
}

function togglePasswordVisibility() {
  const input = Elements.passwordInput;
  const btn = Elements.togglePassword;
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

function updatePasswordStrength() {
  const password = Elements.passwordInput.value;
  
  if (!password) {
    Elements.strengthBar?.classList.add('hidden');
    return;
  }
  
  Elements.strengthBar?.classList.remove('hidden');
  
  // Calculate strength
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  
  const percentage = (strength / 5) * 100;
  
  // Update bar
  if (Elements.strengthFill) {
    Elements.strengthFill.style.width = `${percentage}%`;
    
    // Color based on strength
    const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#22c55e'];
    Elements.strengthFill.style.background = colors[Math.min(strength - 1, 4)] || '#ef4444';
  }
  
  // Update text
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  if (Elements.strengthText) {
    Elements.strengthText.textContent = labels[Math.min(strength - 1, 4)] || 'Very Weak';
    Elements.strengthText.style.color = colors[Math.min(strength - 1, 4)] || '#ef4444';
  }
}

// ===== RESTORE MODAL =====
function openRestoreModal() {
  Elements.restoreModal?.classList.remove('hidden');
  Elements.seedInput?.focus();
}

function closeRestoreModal() {
  Elements.restoreModal?.classList.add('hidden');
  Elements.seedInput.value = '';
  Elements.newPassword.value = '';
  Elements.seedValidation.textContent = '';
}

function validateSeedInput() {
  const phrase = Elements.seedInput.value.trim();
  const words = phrase.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) {
    Elements.seedValidation.textContent = '';
    return;
  }
  
  if (words.length === 12 || words.length === 24) {
    Elements.seedValidation.textContent = '✓ Valid word count';
    Elements.seedValidation.style.color = 'var(--success)';
  } else {
    Elements.seedValidation.textContent = `${words.length} words - need 12 or 24`;
    Elements.seedValidation.style.color = 'var(--text-dim)';
  }
}

async function handleRestore() {
  const seedPhrase = Elements.seedInput.value.trim();
  const password = Elements.newPassword.value;
  
  if (!seedPhrase) {
    alert('Please enter your seed phrase');
    return;
  }
  
  const words = seedPhrase.split(/\s+/).filter(w => w.length > 0);
  if (words.length !== 12 && words.length !== 24) {
    alert('Seed phrase must be 12 or 24 words');
    return;
  }
  
  if (!password || password.length < 8) {
    alert('Password must be at least 8 characters');
    return;
  }
  
  setLoading(true);
  
  try {
    const result = await importWallet(seedPhrase, password, 'Restored Wallet');
    
    if (result.success) {
      alert('Wallet restored successfully!\n\nRemember to write down your seed phrase and store it securely.');
      closeRestoreModal();
      
      // Redirect to main
      window.location.href = '../../popup/popup.html';
    }
  } catch (error) {
    alert('Restore failed: ' + error.message);
  } finally {
    setLoading(false);
  }
}

// ===== UI HELPERS =====
function showError(message) {
  if (Elements.errorText) {
    Elements.errorText.textContent = message;
  }
  Elements.errorBox?.classList.remove('hidden');
  
  // Shake animation
  Elements.form?.classList.add('shake');
  setTimeout(() => {
    Elements.form?.classList.remove('shake');
  }, 500);
}

function hideError() {
  Elements.errorBox?.classList.add('hidden');
}

function setLoading(loading) {
  Elements.unlockBtn.disabled = loading;
  
  if (loading) {
    Elements.btnLoader?.classList.remove('hidden');
  } else {
    Elements.btnLoader?.classList.add('hidden');
  }
}

// Add shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  .shake {
    animation: shake 0.5s ease;
  }
`;
document.head.appendChild(shakeStyle);

console.log('[KernelWallet] Unlock page loaded');
