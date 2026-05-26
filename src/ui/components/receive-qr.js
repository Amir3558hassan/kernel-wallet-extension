/**
 * KernelWallet Receive QR Component
 * Displays QR code with address and copy functionality
 */

class ReceiveQR extends HTMLElement {
  constructor() {
    super();
    this.address = '';
    this.asset = 'ETH';
    this.network = 'ethereum';
    this.qrData = '';
  }

  static get observedAttributes() {
    return ['address', 'asset', 'network'];
  }

  connectedCallback() {
    this.render();
    this.attachEvents();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this[name] = newValue;
      this.update();
    }
  }

  setData(address, asset, network) {
    this.address = address;
    this.asset = asset;
    this.network = network;
    this.qrData = `${asset.toLowerCase()}:${address}?asset=${asset}`;
    this.update();
  }

  render() {
    this.innerHTML = `
      <div class="receive-container">
        <div class="qr-wrapper">
          <div class="qr-frame">
            <div class="qr-code" id="qr-display">
              <div class="qr-placeholder">QR Loading...</div>
            </div>
            <div class="qr-logo">KW</div>
          </div>
          <div class="qr-scan-line"></div>
        </div>

        <div class="address-section">
          <div class="address-label">Your ${this.asset} Address</div>
          <div class="address-box">
            <code class="address-text" id="address-text">${this.address || 'Connect wallet to see address'}</code>
            <button class="copy-btn" id="copy-address-btn" ${!this.address ? 'disabled' : ''}>
              <span class="copy-icon">📋</span>
              <span class="copy-label">Copy</span>
            </button>
          </div>
        </div>

        <div class="network-badge" id="network-badge">
          <span class="badge-dot"></span>
          <span class="badge-text">${this.network}</span>
        </div>

        <div class="warning-box">
          <div class="warning-icon">⚠️</div>
          <div class="warning-text">
            <strong>Send only ${this.asset} on ${this.network}</strong>
            Sending other assets may result in permanent loss.
          </div>
        </div>

        <div class="share-actions">
          <button class="share-btn" id="btn-share" ${!this.address ? 'disabled' : ''}>
            <span>📤</span>
            <span>Share</span>
          </button>
          <button class="share-btn" id="btn-set-amount" ${!this.address ? 'disabled' : ''}>
            <span>💰</span>
            <span>Set Amount</span>
          </button>
        </div>
      </div>
    `;
    
    this.applyStyles();
  }

  applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .receive-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 24px;
        animation: fadeIn 0.4s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .qr-wrapper {
        position: relative;
        padding: 20px;
        background: white;
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      }

      .qr-frame {
        position: relative;
        width: 200px;
        height: 200px;
      }

      .qr-code {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        border-radius: 12px;
        overflow: hidden;
      }

      .qr-placeholder {
        color: #999;
        font-size: 12px;
        text-align: center;
      }

      .qr-logo {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 700;
        box-shadow: 0 2px 10px rgba(99,102,241,0.4);
      }

      .qr-scan-line {
        position: absolute;
        top: 20px;
        left: 20px;
        right: 20px;
        height: 2px;
        background: linear-gradient(90deg, transparent, #6366f1, transparent);
        animation: scan 2s linear infinite;
        opacity: 0.6;
      }

      @keyframes scan {
        0% { transform: translateY(0); }
        100% { transform: translateY(200px); }
      }

      .address-section {
        width: 100%;
        text-align: center;
      }

      .address-label {
        font-size: 13px;
        color: rgba(255,255,255,0.5);
        margin-bottom: 8px;
      }

      .address-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
      }

      .address-text {
        flex: 1;
        font-family: monospace;
        font-size: 13px;
        color: white;
        word-break: break-all;
        background: none;
        padding: 0;
      }

      .copy-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: rgba(99,102,241,0.15);
        border: 1px solid rgba(99,102,241,0.3);
        border-radius: 8px;
        color: #a5b4fc;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .copy-btn:hover:not(:disabled) {
        background: rgba(99,102,241,0.25);
        color: white;
      }

      .copy-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .copy-btn.copied {
        background: rgba(34,197,94,0.15);
        border-color: rgba(34,197,94,0.3);
        color: #22c55e;
      }

      .network-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
      }

      .badge-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 8px rgba(34,197,94,0.4);
        animation: pulse-dot 2s infinite;
      }

      @keyframes pulse-dot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.2); }
      }

      .warning-box {
        display: flex;
        gap: 12px;
        padding: 14px;
        background: rgba(245,158,11,0.08);
        border: 1px solid rgba(245,158,11,0.2);
        border-radius: 12px;
        text-align: left;
      }

      .warning-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      .warning-text {
        font-size: 13px;
        color: rgba(255,255,255,0.7);
        line-height: 1.5;
      }

      .warning-text strong {
        color: #f59e0b;
        display: block;
        margin-bottom: 4px;
      }

      .share-actions {
        display: flex;
        gap: 12px;
        width: 100%;
      }

      .share-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        color: rgba(255,255,255,0.7);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .share-btn:hover:not(:disabled) {
        background: rgba(255,255,255,0.06);
        color: white;
        border-color: rgba(99,102,241,0.3);
      }

      .share-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    
    this.appendChild(style);
  }

  attachEvents() {
    this.querySelector('#copy-address-btn')?.addEventListener('click', () => this.copyAddress());
    this.querySelector('#btn-share')?.addEventListener('click', () => this.shareAddress());
    this.querySelector('#btn-set-amount')?.addEventListener('click', () => this.setAmount());
  }

  update() {
    const qrDisplay = this.querySelector('#qr-display');
    const addressText = this.querySelector('#address-text');
    const networkBadge = this.querySelector('#network-badge');
    const copyBtn = this.querySelector('#copy-address-btn');
    const shareBtns = this.querySelectorAll('.share-btn');
    
    if (addressText) addressText.textContent = this.address || 'Connect wallet to see address';
    
    if (networkBadge) {
      const badgeText = networkBadge.querySelector('.badge-text');
      if (badgeText) badgeText.textContent = this.network;
    }
    
    // Enable/disable buttons
    const hasAddress = !!this.address;
    if (copyBtn) copyBtn.disabled = !hasAddress;
    shareBtns.forEach(btn => btn.disabled = !hasAddress);
    
    // Generate QR (simplified - would use qrcode library in production)
    if (qrDisplay && hasAddress) {
      qrDisplay.innerHTML = this.generateMockQR();
    }
  }

  generateMockQR() {
    // In production, use qrcode-generator.js library
    const size = 180;
    const cells = 25;
    const cellSize = size / cells;
    
    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
    
    // Background
    svg += `<rect width="${size}" height="${size}" fill="white"/>`;
    
    // Random pattern (mock QR)
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        if (Math.random() > 0.5) {
          svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
        }
      }
    }
    
    // Position patterns (corners)
    const drawPosition = (px, py) => {
      svg += `<rect x="${px}" y="${py}" width="21" height="21" fill="black"/>`;
      svg += `<rect x="${px + 2}" y="${py + 2}" width="17" height="17" fill="white"/>`;
      svg += `<rect x="${px + 4}" y="${py + 4}" width="13" height="13" fill="black"/>`;
    };
    
    drawPosition(4, 4);
    drawPosition(size - 25, 4);
    drawPosition(4, size - 25);
    
    svg += '</svg>';
    return svg;
  }

  async copyAddress() {
    if (!this.address) return;
    
    try {
      await navigator.clipboard.writeText(this.address);
      const btn = this.querySelector('#copy-address-btn');
      const originalLabel = btn.querySelector('.copy-label')?.textContent;
      
      btn.classList.add('copied');
      btn.querySelector('.copy-icon').textContent = '✓';
      btn.querySelector('.copy-label').textContent = 'Copied!';
      
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.querySelector('.copy-icon').textContent = '📋';
        btn.querySelector('.copy-label').textContent = originalLabel || 'Copy';
      }, 2000);
      
      this.dispatchEvent(new CustomEvent('address-copied', { bubbles: true }));
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = this.address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  shareAddress() {
    if (!this.address) return;
    
    const shareData = {
      title: 'My KernelWallet Address',
      text: `Send ${this.asset} to my address on ${this.network}:`,
      url: `https://kernelwallet.io/send?to=${this.address}&asset=${this.asset}`
    };
    
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      this.copyAddress();
    }
  }

  setAmount() {
    const amount = prompt('Enter amount (optional):');
    if (amount && !isNaN(parseFloat(amount))) {
      this.qrData = `${this.asset.toLowerCase()}:${this.address}?amount=${amount}`;
      this.update();
      this.dispatchEvent(new CustomEvent('amount-set', {
        detail: { amount },
        bubbles: true
      }));
    }
  }
}

customElements.define('receive-qr', ReceiveQR);

export { ReceiveQR };
