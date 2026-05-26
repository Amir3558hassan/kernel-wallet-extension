/**
 * KernelWallet Password Lock
 * Secure password hashing and verification using PBKDF2
 * Prevents brute-force with iteration count and rate limiting
 */

import { sha256, secureCompare } from './encryption.js';

const PASSWORD_CONFIG = {
  minLength: 8,
  maxLength: 128,
  iterations: 100000,
  saltLength: 32,
  hashAlgorithm: 'SHA-256'
};

let lockoutCount = 0;
let lockoutTimer = null;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 300000; // 5 minutes in ms

/**
 * Generate random salt
 * @returns {string} Hex-encoded salt
 */
function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_CONFIG.saltLength));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash password with PBKDF2
 * @param {string} password - Plain text password
 * @param {string} salt - Hex salt
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = Uint8Array.from(salt.match(/.{2}/g).map(byte => parseInt(byte, 16)));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: PASSWORD_CONFIG.iterations,
      hash: PASSWORD_CONFIG.hashAlgorithm
    },
    keyMaterial,
    256
  );
  
  return Array.from(new Uint8Array(derived))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create password hash for storage
 * @param {string} password - User password
 * @returns {Promise<string>} Stored format: "salt:hash"
 */
async function createPasswordHash(password) {
  validatePasswordStrength(password);
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}

/**
 * Verify password against stored hash
 * @param {string} password - Entered password
 * @param {string} storedHash - Stored salt:hash
 * @returns {Promise<boolean>} True if correct
 */
async function verifyPassword(password, storedHash) {
  // Check lockout
  if (lockoutCount >= MAX_ATTEMPTS) {
    throw new Error('Too many failed attempts. Please wait 5 minutes.');
  }
  
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) throw new Error('Invalid stored hash format');
    
    const testHash = await hashPassword(password, salt);
    
    if (secureCompare(hash, testHash)) {
      lockoutCount = 0; // Reset on success
      return true;
    } else {
      lockoutCount++;
      if (lockoutCount >= MAX_ATTEMPTS) {
        setTimeout(() => { lockoutCount = 0; }, LOCKOUT_DURATION);
      }
      return false;
    }
  } catch (error) {
    lockoutCount++;
    throw error;
  }
}

/**
 * Validate password strength
 * @param {string} password 
 * @throws {Error} If password too weak
 */
function validatePasswordStrength(password) {
  if (!password || password.length < PASSWORD_CONFIG.minLength) {
    throw new Error(`Password must be at least ${PASSWORD_CONFIG.minLength} characters`);
  }
  if (password.length > PASSWORD_CONFIG.maxLength) {
    throw new Error(`Password must not exceed ${PASSWORD_CONFIG.maxLength} characters`);
  }
  
  // Check complexity
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  
  const strength = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  if (strength < 3) {
    throw new Error('Password must contain at least 3 of: uppercase, lowercase, numbers, special characters');
  }
}

/**
 * Check if account is currently locked out
 * @returns {boolean}
 */
function isLockedOut() {
  return lockoutCount >= MAX_ATTEMPTS;
}

/**
 * Get remaining lockout time
 * @returns {number} Milliseconds remaining
 */
function getLockoutTime() {
  if (!isLockedOut()) return 0;
  return LOCKOUT_DURATION;
}

export {
  createPasswordHash,
  verifyPassword,
  validatePasswordStrength,
  isLockedOut,
  getLockoutTime,
  hashPassword,
  generateSalt
};
