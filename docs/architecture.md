# KernelWallet Architecture

## Structure
- background/ = Service worker (always running)
- popup/ = Main wallet UI
- content/ = Talks to websites (dApps)
- core/ = Wallet brain (accounts, transactions)
- security/ = Encryption, passwords
- ui/ = Reusable components

## How it works
1. User clicks icon → popup opens
2. Popup talks to background via messages
3. Background manages wallet data securely
4. Content script injects into web pages for dApps
