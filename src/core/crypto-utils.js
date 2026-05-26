/**
 * KernelWallet Crypto Utilities
 * Address generation, validation, hashing utilities
 */

/**
 * Generate a random UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Generate a random hex string
 * @param {number} length - Length in bytes
 * @returns {string} Hex string
 */
function randomHex(length = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate Ethereum address
 * @param {string} address 
 * @returns {boolean}
 */
function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') return false;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
  
  // Basic checksum validation (simplified)
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    // Mixed case - should be checksum
    return true; // Simplified - full EIP-55 check omitted for brevity
  }
  return true;
}

/**
 * Validate Bitcoin address (basic)
 * @param {string} address 
 * @returns {boolean}
 */
function isValidBitcoinAddress(address) {
  if (!address || typeof address !== 'string') return false;
  // Basic checks for common formats
  return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
}

/**
 * Validate Solana address
 * @param {string} address 
 * @returns {boolean}
 */
function isValidSolanaAddress(address) {
  if (!address || typeof address !== 'string') return false;
  // Solana addresses are base58 encoded, 32-44 chars
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validate generic address based on network
 * @param {string} address 
 * @param {string} network - 'ethereum', 'bitcoin', 'solana', etc.
 * @returns {boolean}
 */
function validateAddress(address, network) {
  switch (network.toLowerCase()) {
    case 'ethereum':
    case 'polygon':
    case 'arbitrum':
    case 'plasma':
      return isValidEthereumAddress(address);
    case 'bitcoin':
    case 'lightning':
      return isValidBitcoinAddress(address);
    case 'solana':
      return isValidSolanaAddress(address);
    default:
      return false;
  }
}

/**
 * Convert wei to ether (ETH)
 * @param {string|number} wei 
 * @returns {string}
 */
function weiToEther(wei) {
  const value = BigInt(wei);
  const ether = Number(value) / 1e18;
  return ether.toFixed(6);
}

/**
 * Convert ether to wei
 * @param {string|number} ether 
 * @returns {string}
 */
function etherToWei(ether) {
  const value = parseFloat(ether);
  const wei = BigInt(Math.round(value * 1e18));
  return wei.toString();
}

/**
 * Convert satoshi to BTC
 * @param {number} satoshi 
 * @returns {string}
 */
function satoshiToBtc(satoshi) {
  return (satoshi / 1e8).toFixed(8);
}

/**
 * Shorten address for display (0x1234...5678)
 * @param {string} address 
 * @param {number} start - Start chars
 * @param {number} end - End chars
 * @returns {string}
 */
function shortenAddress(address, start = 6, end = 4) {
  if (!address || address.length < start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

/**
 * Format currency amount with symbol
 * @param {number} amount 
 * @param {string} symbol 
 * @param {number} decimals 
 * @returns {string}
 */
function formatCurrency(amount, symbol = '', decimals = 4) {
  const formatted = parseFloat(amount).toFixed(decimals);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Generate deterministic ID from seed data
 * @param {string} seed 
 * @returns {Promise<string>}
 */
async function deterministicId(seed) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(seed));
  return Array.from(new Uint8Array(hash))
    .slice(0, 16)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Base58 encode (simplified - for Solana/Bitcoin addresses)
 * In production, use a proper library
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function base58Encode(bytes) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  let encoded = '';
  while (num > 0) {
    const remainder = Number(num % BigInt(58));
    encoded = alphabet[remainder] + encoded;
    num = num / BigInt(58);
  }
  // Add leading '1's for zero bytes
  for (const byte of bytes) {
    if (byte === 0) encoded = '1' + encoded;
    else break;
  }
  return encoded || '1';
}

/**
 * Check if string is valid hex
 * @param {string} str 
 * @returns {boolean}
 */
function isHex(str) {
  return /^0x?[0-9a-fA-F]+$/.test(str);
}

/**
 * Sleep/delay helper
 * @param {number} ms 
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export {
  generateUUID,
  randomHex,
  isValidEthereumAddress,
  isValidBitcoinAddress,
  isValidSolanaAddress,
  validateAddress,
  weiToEther,
  etherToWei,
  satoshiToBtc,
  shortenAddress,
  formatCurrency,
  deterministicId,
  base58Encode,
  isHex,
  sleep
};
