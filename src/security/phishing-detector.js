/**
 * KernelWallet Phishing Detector
 * Protects users from malicious websites and fake wallet interfaces
 */

// Known phishing domains (simplified - in production load from external API)
const BLACKLIST = new Set([
  'metamask.com.phishing-site.com',
  'kernelwallet-verify.com',
  'tether-rewards.net',
  'wallet-connect-scam.io',
  'ethereum-secure-check.org'
]);

// Known legitimate domains for exact matching
const WHITELIST = new Set([
  'kernelwallet.io',
  'tether.to',
  'ethereum.org',
  'solana.com',
  'bitcoin.org',
  'polygon.technology',
  'arbiscan.io',
  'etherscan.io'
]);

// Suspicious keywords in domain
const SUSPICIOUS_PATTERNS = [
  /wallet.*verify/i,
  /secure.*check/i,
  /claim.*reward/i,
  /airdrop.*now/i,
  /connect.*wallet/i,
  /metamask.*login/i,
  /private.*key/i,
  /seed.*phrase/i,
  /recover.*wallet/i
];

/**
 * Check if URL is potentially phishing
 * @param {string} url - Full URL
 * @returns {object} Result with threat level
 */
function checkUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Check whitelist first
    if (WHITELIST.has(domain)) {
      return { safe: true, threat: 'none', reason: null };
    }
    
    // Check blacklist
    if (BLACKLIST.has(domain)) {
      return { 
        safe: false, 
        threat: 'high', 
        reason: 'Known phishing domain' 
      };
    }
    
    // Check for lookalike domains (homograph attack)
    if (isLookalikeDomain(domain)) {
      return { 
        safe: false, 
        threat: 'high', 
        reason: 'Possible fake domain (lookalike attack)' 
      };
    }
    
    // Check suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(domain)) {
        return { 
          safe: false, 
          threat: 'medium', 
          reason: `Suspicious pattern detected: ${pattern.source}` 
        };
      }
    }
    
    // Check for IP addresses instead of domains
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
      return { 
        safe: false, 
        threat: 'medium', 
        reason: 'Direct IP address - potential phishing' 
      };
    }
    
    // Check for very long domains (obfuscation)
    if (domain.length > 50) {
      return { 
        safe: false, 
        threat: 'low', 
        reason: 'Unusually long domain name' 
      };
    }
    
    return { safe: true, threat: 'none', reason: null };
    
  } catch (error) {
    return { safe: false, threat: 'high', reason: 'Invalid URL format' };
  }
}

/**
 * Detect lookalike domains using Unicode normalization
 * @param {string} domain 
 * @returns {boolean}
 */
function isLookalikeDomain(domain) {
  const normalized = domain.normalize('NFKC');
  
  // Check for mixed scripts (e.g., Cyrillic + Latin)
  const hasLatin = /[a-z]/.test(normalized);
  const hasCyrillic = /[\u0400-\u04FF]/.test(normalized);
  const hasGreek = /[\u0370-\u03FF]/.test(normalized);
  
  const scriptCount = [hasLatin, hasCyrillic, hasGreek].filter(Boolean).length;
  if (scriptCount > 1) return true;
  
  // Check common lookalikes
  const lookalikes = {
    'a': '[аàáâãäåāăąαа]', // Latin a + Cyrillic а + Greek α
    'e': '[еèéêëēĕėęěεе]',
    'o': '[оòóôõöøōŏőοо]',
    'p': '[рρр]', // Cyrillic р looks like p
    'x': '[хχх]'
  };
  
  // Simplified check - in production use more robust detection
  return false;
}

/**
 * Check if transaction request is suspicious
 * @param {object} tx - Transaction object
 * @returns {object} Analysis result
 */
function analyzeTransaction(tx) {
  const warnings = [];
  
  // Check for high value
  if (tx.value && parseFloat(tx.value) > 1000000) {
    warnings.push('Very high transaction value');
  }
  
  // Check for token approval (common scam)
  if (tx.data && tx.data.includes('approve')) {
    warnings.push('Token approval request - verify contract address');
  }
  
  // Check for unknown contract
  if (tx.to && !isKnownContract(tx.to)) {
    warnings.push('Interacting with unknown contract');
  }
  
  // Check for self-destruct
  if (tx.data && tx.data.includes('selfdestruct')) {
    warnings.push('CRITICAL: Contract self-destruct detected');
  }
  
  return {
    safe: warnings.length === 0,
    warnings: warnings,
    threat: warnings.length > 0 ? 'medium' : 'none'
  };
}

/**
 * Check if contract is known (simplified)
 * @param {string} address 
 * @returns {boolean}
 */
function isKnownContract(address) {
  // In production, check against verified contract database
  const knownContracts = [
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'  // WBTC
  ];
  return knownContracts.includes(address.toLowerCase());
}

/**
 * Show warning to user
 * @param {string} reason 
 */
function showPhishingWarning(reason) {
  const warning = `
⚠️ SECURITY WARNING ⚠️

${reason}

This website may be attempting to steal your funds or private keys.

[Go Back] [Proceed Anyway (Not Recommended)]
  `;
  
  console.warn(warning);
  return warning;
}

/**
 * Block page interaction
 */
function blockPageInteraction() {
  document.body.style.pointerEvents = 'none';
  document.body.style.filter = 'blur(5px)';
  
  const overlay = document.createElement('div');
  overlay.id = 'kernelwallet-phishing-block';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.9);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  `;
  
  overlay.innerHTML = `
    <div style="background: #1a1a2e; padding: 40px; border-radius: 16px; max-width: 500px; text-align: center; color: white; border: 2px solid #e74c3c;">
      <h2 style="color: #e74c3c; margin-bottom: 20px;">🛡️ Phishing Detected</h2>
      <p style="margin-bottom: 20px; line-height: 1.6;">KernelWallet has detected a potentially malicious website. Your funds may be at risk.</p>
      <button onclick="window.location.href='about:blank'" style="background: #e74c3c; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">Leave Site Immediately</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
}

export {
  checkUrl,
  isLookalikeDomain,
  analyzeTransaction,
  showPhishingWarning,
  blockPageInteraction,
  BLACKLIST,
  WHITELIST
};
