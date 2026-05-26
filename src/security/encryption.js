/**
 * KernelWallet Encryption Module
 * Uses Web Crypto API for secure encryption/decryption
 * AES-GCM with PBKDF2 key derivation
 */

const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  saltLength: 16,
  iterations: 100000, // High iteration count for security
  tagLength: 128
};

/**
 * Generate a random salt for key derivation
 * @returns {Uint8Array} Random salt
 */
function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.saltLength));
}

/**
 * Generate a random IV for AES-GCM
 * @returns {Uint8Array} Random IV
 */
function generateIV() {
  return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));
}

/**
 * Derive encryption key from password using PBKDF2
 * @param {string} password - User password
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>} Derived key
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ENCRYPTION_CONFIG.iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: ENCRYPTION_CONFIG.algorithm,
      length: ENCRYPTION_CONFIG.keyLength
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt sensitive data with password
 * @param {string} plaintext - Data to encrypt
 * @param {string} password - User password
 * @returns {Promise<string>} Encrypted data as base64 string
 */
async function encrypt(plaintext, password) {
  try {
    const salt = generateSalt();
    const iv = generateIV();
    const key = await deriveKey(password, salt);
    
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength
      },
      key,
      data
    );
    
    // Combine salt + iv + ciphertext
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...result));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data with password
 * @param {string} ciphertext - Base64 encrypted data
 * @param {string} password - User password
 * @returns {Promise<string>} Decrypted plaintext
 */
async function decrypt(ciphertext, password) {
  try {
    const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    
    const salt = data.slice(0, ENCRYPTION_CONFIG.saltLength);
    const iv = data.slice(ENCRYPTION_CONFIG.saltLength, ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength);
    const encrypted = data.slice(ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength);
    
    const key = await deriveKey(password, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength
      },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Invalid password or corrupted data');
  }
}

/**
 * Securely compare two strings (timing-safe)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if equal
 */
function secureCompare(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Hash data using SHA-256 (one-way, for checksums)
 * @param {string} data - Data to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
async function sha256(data) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export {
  encrypt,
  decrypt,
  secureCompare,
  sha256,
  generateSalt,
  generateIV
};
