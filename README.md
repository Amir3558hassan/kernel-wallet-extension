# KernelWallet

A secure, self-custodial, multi-chain browser extension wallet built with WDK.

## Features

- Multi-Asset Support: BTC, USDT, XAUt, ETH, SOL
- Multi-Network: Bitcoin, Lightning, Ethereum, Polygon, Arbitrum, Plasma, Solana
- Security: Seed phrase, password lock, session timeout, phishing detection
- Extension Architecture: Background service worker, secure storage, message passing

## Installation

1. Clone the repository
2. Run `npm install`
3. Run `npm run build`
4. Load `dist/` folder as unpacked extension in Chrome

## Security

- Encryption: AES-GCM-256 with PBKDF2 (100K iterations)
- Session: Auto-lock after inactivity
- Phishing: Real-time malicious site detection
- Password: Strength validation + brute-force protection

## Tech Stack

- Chrome Extension Manifest V3
- ES6 Modules
- Webpack 5
- Web Crypto API

## License

MIT
