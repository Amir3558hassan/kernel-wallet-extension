/**
 * KernelWallet Wallet Selector Component
 * Switch between wallets and accounts with animated transitions
 */

class WalletSelector extends HTMLElement {
  constructor() {
    super();
    this.wallets = [];
    this.activeWalletId = null;
    this.isOpen = false;
  }

  connectedCallback() {
    this.render();
    this.attachEvents();
  }

  setWallets(wallets, activeId) {
    this.wallets = wallets || [];
    this.activeWalletId = activeId;
    this.updateDisplay();
  }

  render() {
    this.innerHTML = `
      <div class="wallet-selector">
        <div class="selector-trigger" id="selector-trigger">
          <div class="wallet-preview">
            <div class="wallet-avatar" id="wallet-avatar">KW</div>
            <div class="wallet-info">
              <div class="wallet-name" id="wallet-name">Select Wallet</div>
              <div class="wallet-meta" id="wallet-meta">--</div>
            </div>
          </div>
          <svg class="selector-arrow" width="14" height="14" viewBox="0 0 14 14">
            <path d="M3 5L7 9L11 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          </svg>
        </div>

        <div class="wallet-dropdown hidden" id="wallet-dropdown">
          <div class="dropdown-header">
            <span>Your Wallets</span>
            <button class="add-wallet-btn" id="btn-add-wallet">+ Add</button>
          </div>
          
          <div class="wallet-list" id="wallet-list"></div>
          
          <div class="dropdown-footer">
            <button class="manage-btn" id="btn-manage">Manage Wallets</button>
          </div>
        </div>
      </div>
    `;
    
    this.applyStyles();
  }

  applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .wallet-selector {
        position: relative;
      }

      .selector-trigger {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .selector-trigger:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(99,102,241,0.2);
      }

      .selector-trigger.active {
        border-color: rgba(99,102,241,0.4);
      }

      .wallet-preview {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
      }

      .wallet-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 700;
        flex-shrink: 0;
      }

      .wallet-info {
        flex: 1;
        min-width: 0;
      }

      .wallet-name {
        font-size: 15px;
        font-weight: 600;
        color: white;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wallet-meta {
        font-size: 12px;
        color: rgba(255,255,255,0.4);
      }

      .selector-arrow {
        color: rgba(255,255,255,0.4);
        transition: transform 0.3s;
        flex-shrink: 0;
      }

      .selector-trigger.active .selector-arrow {
        transform: rotate(180deg);
      }

      .wallet-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        background: #12122a;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        padding: 8px;
        z-index: 200;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        animation: dropdownSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes dropdownSlide {
        from { opacity: 0; transform: translateY(-10px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .dropdown-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        margin-bottom: 4px;
      }

      .dropdown-header span {
        font-size: 12px;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
      }

      .add-wallet-btn {
        background: rgba(99,102,241,0.15);
        border: 1px solid rgba(99,102,241,0.3);
        color: #a5b4fc;
        padding: 4px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .add-wallet-btn:hover {
        background: rgba(99,102,241,0.25);
        color: white;
      }

      .wallet-list {
        max-height: 300px;
        overflow-y: auto;
      }

      .wallet-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.15s;
        position: relative;
      }

      .wallet-item:hover {
        background: rgba(255,255,255,0.05);
      }

      .wallet-item.active {
        background: rgba(99,102,241,0.1);
      }

      .wallet-item .wallet-avatar {
        width: 36px;
        height: 36px;
        font-size: 12px;
      }

      .wallet-item .wallet-info {
        flex: 1;
      }

      .wallet-item .wallet-name {
        font-size: 14px;
      }

      .wallet-item .wallet-meta {
        font-size: 11px;
      }

      .active-indicator {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(34,197,94,0.15);
        color: #22c55e;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
      }

      .dropdown-footer {
        padding: 8px 12px 4px;
        border-top: 1px solid rgba(255,255,255,0.05);
        margin-top: 4px;
      }

      .manage-btn {
        width: 100%;
        padding: 10px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        color: rgba(255,255,255,0.6);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .manage-btn:hover {
        background: rgba(255,255,255,0.06);
        color: white;
      }

      .hidden { display: none !important; }
    `;
    
    this.appendChild(style);
  }

  attachEvents() {
    const trigger = this.querySelector('#selector-trigger');
    const dropdown = this.querySelector('#wallet-dropdown');
    
    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isOpen = !this.isOpen;
      trigger.classList.toggle('active', this.isOpen);
      dropdown?.classList.toggle('hidden', !this.isOpen);
      
      if (this.isOpen) {
        this.renderWalletList();
      }
    });
    
    // Close on outside click
    document.addEventListener('click', () => {
      this.isOpen = false;
      trigger?.classList.remove('active');
      dropdown?.classList.add('hidden');
    });
    
    // Add wallet
    this.querySelector('#btn-add-wallet')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('add-wallet', { bubbles: true }));
    });
    
    // Manage wallets
    this.querySelector('#btn-manage')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('manage-wallets', { bubbles: true }));
    });
  }

  updateDisplay() {
    const activeWallet = this.wallets.find(w => w.id === this.activeWalletId) || this.wallets[0];
    
    if (!activeWallet) return;
    
    const avatar = this.querySelector('#wallet-avatar');
    const name = this.querySelector('#wallet-name');
    const meta = this.querySelector('#wallet-meta');
    
    if (avatar) {
      avatar.textContent = activeWallet.name?.slice(0, 2).toUpperCase() || 'KW';
    }
    
    if (name) {
      name.textContent = activeWallet.name || 'My Wallet';
    }
    
    if (meta) {
      const accountCount = activeWallet.accountCount || activeWallet.accounts?.length || 0;
      meta.textContent = `${accountCount} account${accountCount !== 1 ? 's' : ''}`;
    }
  }

  renderWalletList() {
    const list = this.querySelector('#wallet-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    for (const wallet of this.wallets) {
      const item = document.createElement('div');
      item.className = `wallet-item ${wallet.id === this.activeWalletId ? 'active' : ''}`;
      
      const accountCount = wallet.accountCount || wallet.accounts?.length || 0;
      
      item.innerHTML = `
        <div class="wallet-avatar" style="background: ${this.getWalletColor(wallet.id)};">
          ${wallet.name?.slice(0, 2).toUpperCase() || 'W'}
        </div>
        <div class="wallet-info">
          <div class="wallet-name">${wallet.name || 'Wallet'}</div>
          <div class="wallet-meta">${accountCount} account${accountCount !== 1 ? 's' : ''}</div>
        </div>
        ${wallet.id === this.activeWalletId ? '<div class="active-indicator">✓</div>' : ''}
      `;
      
      item.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('wallet-select', {
          detail: { walletId: wallet.id },
          bubbles: true
        }));
        
        this.activeWalletId = wallet.id;
        this.updateDisplay();
        this.isOpen = false;
        this.querySelector('#selector-trigger')?.classList.remove('active');
        this.querySelector('#wallet-dropdown')?.classList.add('hidden');
      });
      
      list.appendChild(item);
    }
  }

  getWalletColor(id) {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
}

customElements.define('wallet-selector', WalletSelector);

export { WalletSelector };
