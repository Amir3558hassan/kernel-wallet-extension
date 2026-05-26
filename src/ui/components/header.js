/**
 * KernelWallet Header Component
 * Reusable app header with network switcher, settings, and lock
 */

class WalletHeader extends HTMLElement {
  constructor() {
    super();
    this.network = 'ethereum';
    this.walletName = 'My Wallet';
  }

  static get observedAttributes() {
    return ['network', 'wallet-name'];
  }

  connectedCallback() {
    this.render();
    this.attachEvents();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this[name.replace('-', '')] = newValue;
      this.update();
    }
  }

  render() {
    this.innerHTML = `
      <header class="kw-header">
        <div class="header-left">
          <div class="network-selector" id="network-selector">
            <span class="network-indicator" id="network-indicator"></span>
            <span class="network-label" id="network-label">Ethereum</span>
            <svg class="network-chevron" width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
          </div>
        </div>
        
        <div class="header-center">
          <span class="app-logo">KernelWallet</span>
        </div>
        
        <div class="header-right">
          <button class="header-btn" id="btn-settings" title="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v10m11-7h-6m-6 0H1m20.07-4.93l-4.24 4.24M7.17 16.83l-4.24 4.24m0-14.14l4.24 4.24m9.9 9.9l4.24 4.24"/>
            </svg>
          </button>
          <button class="header-btn" id="btn-lock" title="Lock Wallet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </button>
        </div>
      </header>
      
      <div class="network-dropdown hidden" id="network-dropdown">
        <div class="dropdown-header">Select Network</div>
        <div class="network-list" id="network-list"></div>
      </div>
    `;
    
    this.applyStyles();
  }

  applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .kw-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: linear-gradient(180deg, rgba(99,102,241,0.1) 0%, transparent 100%);
        border-bottom: 1px solid rgba(255,255,255,0.05);
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(10px);
      }

      .network-selector {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;
        font-weight: 600;
      }

      .network-selector:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(99,102,241,0.3);
      }

      .network-indicator {
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

      .network-chevron {
        opacity: 0.5;
        transition: transform 0.2s;
      }

      .network-selector.active .network-chevron {
        transform: rotate(180deg);
      }

      .app-logo {
        font-size: 16px;
        font-weight: 700;
        background: linear-gradient(135deg, #fff, #a5b4fc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .header-btn {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.6);
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      }

      .header-btn:hover {
        background: rgba(255,255,255,0.08);
        color: white;
        border-color: rgba(99,102,241,0.3);
      }

      .network-dropdown {
        position: absolute;
        top: 56px;
        left: 12px;
        width: 220px;
        background: #12122a;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        padding: 8px;
        z-index: 200;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        animation: dropdown-in 0.2s ease;
      }

      @keyframes dropdown-in {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .dropdown-header {
        padding: 8px 12px;
        font-size: 12px;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
      }

      .network-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .network-item:hover {
        background: rgba(255,255,255,0.05);
      }

      .network-item.active {
        background: rgba(99,102,241,0.15);
      }

      .network-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        box-shadow: 0 0 6px currentColor;
      }

      .network-info {
        flex: 1;
      }

      .network-name {
        font-size: 14px;
        font-weight: 500;
        color: white;
      }

      .network-status {
        font-size: 12px;
        color: rgba(255,255,255,0.4);
      }

      .network-check {
        color: #6366f1;
        font-weight: 700;
      }

      .hidden { display: none !important; }
    `;
    
    if (!this.querySelector('style')) {
      this.appendChild(style);
    }
  }

  attachEvents() {
    const networkSelector = this.querySelector('#network-selector');
    const dropdown = this.querySelector('#network-dropdown');
    const btnLock = this.querySelector('#btn-lock');
    const btnSettings = this.querySelector('#btn-settings');
    
    networkSelector?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle('hidden');
      networkSelector.classList.toggle('active');
      
      if (!dropdown?.classList.contains('hidden')) {
        this.renderNetworkList();
      }
    });
    
    // Close dropdown on outside click
    document.addEventListener('click', () => {
      dropdown?.classList.add('hidden');
      networkSelector?.classList.remove('active');
    });
    
    btnLock?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('lock-wallet', { bubbles: true }));
    });
    
    btnSettings?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('open-settings', { bubbles: true }));
    });
  }

  renderNetworkList() {
    const list = this.querySelector('#network-list');
    if (!list) return;
    
    const networks = [
      { id: 'ethereum', name: 'Ethereum', color: '#627EEA', status: 'Connected' },
      { id: 'polygon', name: 'Polygon', color: '#8247E5', status: 'Connected' },
      { id: 'arbitrum', name: 'Arbitrum', color: '#28A0F0', status: 'Connected' },
      { id: 'bitcoin', name: 'Bitcoin', color: '#F7931A', status: 'Connected' },
      { id: 'solana', name: 'Solana', color: '#14F195', status: 'Connected' },
      { id: 'lightning', name: 'Lightning', color: '#792EE5', status: 'Spark' }
    ];
    
    list.innerHTML = networks.map(n => `
      <div class="network-item ${n.id === this.network ? 'active' : ''}" data-network="${n.id}">
        <span class="network-dot" style="background: ${n.color}; color: ${n.color};"></span>
        <div class="network-info">
          <div class="network-name">${n.name}</div>
          <div class="network-status">${n.status}</div>
        </div>
        ${n.id === this.network ? '<span class="network-check">✓</span>' : ''}
      </div>
    `).join('');
    
    // Attach click handlers
    list.querySelectorAll('.network-item').forEach(item => {
      item.addEventListener('click', () => {
        const networkId = item.dataset.network;
        this.dispatchEvent(new CustomEvent('network-change', {
          detail: { network: networkId },
          bubbles: true
        }));
        this.querySelector('#network-dropdown')?.classList.add('hidden');
      });
    });
  }

  update() {
    const indicator = this.querySelector('#network-indicator');
    const label = this.querySelector('#network-label');
    
    const networkColors = {
      ethereum: '#627EEA',
      polygon: '#8247E5',
      arbitrum: '#28A0F0',
      bitcoin: '#F7931A',
      solana: '#14F195',
      lightning: '#792EE5'
    };
    
    const networkNames = {
      ethereum: 'Ethereum',
      polygon: 'Polygon',
      arbitrum: 'Arbitrum',
      bitcoin: 'Bitcoin',
      solana: 'Solana',
      lightning: 'Lightning'
    };
    
    if (indicator) {
      indicator.style.background = networkColors[this.network] || '#627EEA';
      indicator.style.boxShadow = `0 0 8px ${networkColors[this.network] || '#627EEA'}66`;
    }
    
    if (label) {
      label.textContent = networkNames[this.network] || 'Ethereum';
    }
  }
}

// Register custom element
customElements.define('wallet-header', WalletHeader);

export { WalletHeader };
