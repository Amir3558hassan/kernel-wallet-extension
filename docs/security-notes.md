# KernelWallet Security Notes

## Threat Model

### Protected Against
- Phishing websites
- Session hijacking
- XSS attacks
- Clickjacking
- Brute-force password attacks

### User Responsibilities
- Secure seed phrase backup
- Strong password
- Safe browsing habits

## Implementation Details

### Encryption
- Algorithm: AES-GCM-256
- Key Derivation: PBKDF2 with 100,000 iterations
- Salt: 16 bytes random per encryption
- IV: 12 bytes random per operation

### Session Management
- Auto-lock: Configurable (default 10 min)
- Lockout: 5 failed attempts = 5 min cooldown
- Memory wipe: On lock, all sensitive data cleared

### Content Security
- CSP: Strict policy in manifest
- No inline scripts
- No eval()
- WASM allowed for crypto libraries

## Audit Checklist

- [ ] Password strength validation
- [ ] Secure comparison (timing-safe)
- [ ] Input sanitization
- [ ] Origin validation on messages
- [ ] HTTPS-only RPC connections
