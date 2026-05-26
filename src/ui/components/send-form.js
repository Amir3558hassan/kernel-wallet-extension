/**
 * KernelWallet Send Form Component
 * Interactive send form with real-time validation and QR support
 */

class SendForm extends HTMLElement {
  constructor() {
    super();
    this.assets = [];
    this.selectedAsset = 'ETH';
    this.balance = '0';
    this.recipient = '';
    this.amount = '';
    this.isValid = false;
  }

  connectedCallback() {
    this.render();
    this.attachEvents();
  }

  setAssets(assets) {
    this.assets = assets;
    this.updateAssetSelect();
  }

  setBalance(asset, balance) {
    this.balance = balance;
    if (this.selectedAsset === asset) {
      this.updateBalanceHint();
    }
  }

  render() {
    this.innerHTML = `
      <form class="send-form" id="send-form-component">
        <div class="form-section">
          <label class="form-label">Select Asset</label>
          <div class="asset-selector" id="asset-selector">
            <div class="selected-asset" id="selected-asset">
              <span class="asset-icon" id="asset-icon">Ξ</span>
              <div class="asset-info">
                <span class="asset-name" id="asset-name">Ethereum</span>
                <span class="asset-balance" id="asset-balance">0 ETH</span>
              </div>
              <svg class="selector-chevron" width="12" height="12" viewBox="0 0 12 12">
                <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" fill="none"/>
              </svg>
            </div>
            <div class="asset-dropdown hidden" id="asset-dropdown"></div>
          </div>
        </div>

        <div class="form-section">
          <label class="form-label">Recipient Address</label>
          <div class="address-input-wrapper">
            <input 
              type="text" 
              class="address-input" 
              id="address-input"
              placeholder="0x... or bc1... or SOL..."
              autocomplete="off"
            >
            <div class="address-actions">
              <button type="button" class="action-btn" id="btn-paste" title="Paste">
                📋
              </button>
              <button type="button" class="action-btn" id="btn-scan" title="Scan QR">
                📷
              </button>
              <button type="button" class="action-btn" id="btn-contacts" title="Contacts">
                👤
              </button>
            </div>
          </div>
          <div class="validation-msg" id="address-validation"></div>
        </div>

        <div class="form-section">
          <label class="form-label">Amount</label>
          <div class="amount-input-wrapper">
            <input 
              type="number" 
              class="amount-input" 
              id="amount-input"
              placeholder="0.00"
              step="any"
              min="0"
            >
            <button type="button" class="max-btn" id="btn-max">MAX</button>
          </div>
          <div class="amount-hint" id="amount-hint">
            Available: <span id="available-balance">0.00</span> 
            <span id="available-symbol">ETH</span>
          </div>
        </div>

        <div class="fee-estimate" id="fee-estimate">
          <div class="fee-row">
            <span>Network Fee</span>
            <span class="fee-value" id="network-fee">~$0.00</span>
          </div>
          <div class="fee-row">
            <span>Total</span>
            <span class="fee-value total" id="total-amount">0.00 ETH</span>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-review" disabled>
            Review Send
          </button>
        </div>
      </form>
    `;
    
    this.applyStyles();
  }

  applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .send-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 16px;
      }

      .form-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .form-label {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255,255,255,0.6);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .asset-selector {
        position: relative;
      }

      .selected-asset {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .selected-asset:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(99,102,241,0.3);
      }

      .asset-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 700;
      }

      .asset-info {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .asset-name {
        font-size: 15px;
        font-weight: 600;
        color: white;
      }

      .asset-balance {
        font-size: 13px;
        color: rgba(255,255,255,0.5);
      }

      .selector-chevron {
        opacity: 0.5;
        transition: transform 0.2s;
      }

      .asset-selector.open .selector-chevron {
        transform: rotate(180deg);
      }

      .asset-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        background: #12122a;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        padding: 8px;
        z-index: 100;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        animation: dropdown-in 0.2s ease;
      }

      .asset-dropdown-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .asset-dropdown-item:hover {
        background: rgba(255,255,255,0.05);
      }

      .asset-dropdown-item.active {
        background: rgba(99,102,241,0.15);
      }

      .address-input-wrapper {
        position: relative;
      }

      .address-input {
        width: 100%;
        padding: 14px 120px 14px 16px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        color: white;
        font-size: 15px;
        outline: none;
        transition: all 0.3s;
      }

      .address-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 4px rgba(99,102,241,0.1);
      }

      .address-input.valid {
        border-color: #22c55e;
        box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
      }

      .address-input.invalid {
        border-color: #ef4444;
        box-shadow: 0 0 0 4px rgba(239,68,68,0.1);
      }

      .address-actions {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        gap: 4px;
      }

      .action-btn {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.6);
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .action-btn:hover {
        background: rgba(255,255,255,0.1);
        color: white;
      }

      .validation-msg {
        font-size: 12px;
        min-height: 18px;
        margin-top: 4px;
        transition: all 0.3s;
      }

      .validation-msg.valid {
        color: #22c55e;
      }

      .validation-msg.invalid {
        color: #ef4444;
      }

      .amount-input-wrapper {
        position: relative;
      }

      .amount-input {
        width: 100%;
        padding: 14px 70px 14px 16px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        color: white;
        font-size: 18px;
        font-weight: 600;
        outline: none;
        transition: all 0.3s;
      }

      .amount-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 4px rgba(99,102,241,0.1);
      }

      .max-btn {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        padding: 6px 12px;
        background: rgba(99,102,241,0.15);
        border: 1px solid rgba(99,102,241,0.3);
        border-radius: 8px;
        color: #a5b4fc;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .max-btn:hover {
        background: rgba(99,102,241,0.25);
        color: white;
      }

      .amount-hint {
        font-size: 12px;
        color: rgba(255,255,255,0.4);
        margin-top: 6px;
      }

      .fee-estimate {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .fee-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
      }

      .fee-row span:first-child {
        color: rgba(255,255,255,0.5);
      }

      .fee-value {
        font-weight: 600;
        color: white;
      }

      .fee-value.total {
        font-size: 16px;
        color: #a5b4fc;
      }

      .form-actions {
        display: flex;
        gap: 12px;
        margin-top: 8px;
      }

      .btn {
        flex: 1;
        padding: 16px;
        border-radius: 14px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
        border: none;
      }

      .btn-primary {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        box-shadow: 0 4px 15px rgba(99,102,241,0.3);
      }

      .btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(99,102,241,0.4);
      }

      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-secondary {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.7);
      }

      .btn-secondary:hover {
        background: rgba(255,255,255,0.08);
        color: white;
      }

      @keyframes dropdown-in {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .hidden { display: none !important; }
    `;
    
    this.appendChild(style);
  }

  attachEvents() {
    // Asset selector
    const assetSelector = this.querySelector('#asset-selector');
    const dropdown = this.querySelector('#asset-dropdown');
    
    assetSelector?.addEventListener('click', (e) => {
      e.stopPropagation();
      assetSelector.classList.toggle('open');
      dropdown?.classList.toggle('hidden');
      
      if (!dropdown?.classList.contains('hidden')) {
        this.renderAssetDropdown();
      }
    });
    
    document.addEventListener('click', () => {
      assetSelector?.classList.remove('open');
      dropdown?.classList.add('hidden');
    });
    
    // Address validation
    const addressInput = this.querySelector('#address-input');
    addressInput?.addEventListener('input', () => this.validateAddress());
    
    // Amount
    const amountInput = this.querySelector('#amount-input');
    amountInput?.addEventListener('input', () => this.validateAmount());
    
    // Buttons
    this.querySelector('#btn-paste')?.addEventListener('click', () => this.pasteAddress());
    this.querySelector('#btn-max')?.addEventListener('click', () => this.setMaxAmount());
    this.querySelector('#btn-cancel')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('cancel-send', { bubbles: true }));
    });
    
    // Form submit
    this.querySelector('#send-form-component')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.isValid) {
        this.dispatchEvent(new CustomEvent('review-send', {
          detail: {
            asset: this.selectedAsset,
            to: this.recipient,
            amount: this.amount
          },
          bubbles: true
        }));
      }
    });
  }

  renderAssetDropdown() {
    const dropdown = this.querySelector('#asset-dropdown');
    if (!dropdown) return;
    
    const assets = this.assets.length > 0 ? this.assets : [
      { symbol: 'ETH', name: 'Ethereum', balance: '0.00', icon: 'Ξ' },
      { symbol: 'USDT', name: 'Tether USD', balance: '0.00', icon: '₮' },
      { symbol: 'BTC', name: 'Bitcoin', balance: '0.00', icon: '₿' },
      { symbol: 'SOL', name: 'Solana', balance: '0.00', icon: '◎' }
    ];
    
    dropdown.innerHTML = assets.map(a => `
      <div class="asset-dropdown-item ${a.symbol === this.selectedAsset ? 'active' : ''}" data-asset="${a.symbol}">
        <span class="asset-icon" style="width: 36px; height: 36px; font-size: 16px;">${a.icon}</span>
        <div class="asset-info">
          <div class="asset-name">${a.name}</div>
          <div class="asset-balance">${a.balance} ${a.symbol}</div>
        </div>
      </div>
    `).join('');
    
    dropdown.querySelectorAll('.asset-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectedAsset = item.dataset.asset;
        this.updateSelectedAsset();
        dropdown.classList.add('hidden');
      });
    });
  }

  updateSelectedAsset() {
    const assets = this.assets.length > 0 ? this.assets : [
      { symbol: 'ETH', name: 'Ethereum', balance: '0.00', icon: 'Ξ' },
      { symbol: 'USDT', name: 'Tether USD', balance: '0.00', icon: '₮' },
      { symbol: 'BTC', name: 'Bitcoin', balance: '0.00', icon: '₿' },
      { symbol: 'SOL', name: 'Solana', balance: '0.00', icon: '◎' }
    ];
    
    const asset = assets.find(a => a.symbol === this.selectedAsset) || assets[0];
    
    const icon = this.querySelector('#asset-icon');
    const name = this.querySelector('#asset-name');
    const balance = this.querySelector('#asset-balance');
    
    if (icon) icon.textContent = asset.icon;
    if (name) name.textContent = asset.name;
    if (balance) balance.textContent = `${asset.balance} ${asset.symbol}`;
    
    this.updateBalanceHint();
  }

  updateAssetSelect() {
    this.updateSelectedAsset();
  }

  updateBalanceHint() {
    const available = this.querySelector('#available-balance');
    const symbol = this.querySelector('#available-symbol');
    
    if (available) available.textContent = this.balance;
    if (symbol) symbol.textContent = this.selectedAsset;
  }

  async pasteAddress() {
    try {
      const text = await navigator.clipboard.readText();
      const input = this.querySelector('#address-input');
      if (input) {
        input.value = text.trim();
        this.validateAddress();
      }
    } catch (e) {
      // Clipboard access denied
    }
  }

  setMaxAmount() {
    const input = this.querySelector('#amount-input');
    if (input && this.balance) {
      input.value = this.balance;
      this.validateAmount();
    }
  }

  validateAddress() {
    const input = this.querySelector('#address-input');
    const msg = this.querySelector('#address-validation');
    
    this.recipient = input?.value?.trim() || '';
    
    if (!this.recipient) {
      input?.classList.remove('valid', 'invalid');
      msg.textContent = '';
      this.checkFormValidity();
      return;
    }
    
    // Simple validation (would use crypto-utils in production)
    let isValid = false;
    if (this.recipient.startsWith('0x') && this.recipient.length === 42) isValid = true;
    else if (this.recipient.startsWith('bc1') || this.recipient.startsWith('1') || this.recipient.startsWith('3')) isValid = true;
    else if (this.recipient.length >= 32 && this.recipient.length <= 44) isValid = true;
    
    if (isValid) {
      input?.classList.add('valid');
      input?.classList.remove('invalid');
      msg.textContent = '✓ Valid address';
      msg.className = 'validation-msg valid';
    } else {
      input?.classList.add('invalid');
      input?.classList.remove('valid');
      msg.textContent = '✗ Invalid address format';
      msg.className = 'validation-msg invalid';
    }
    
    this.checkFormValidity();
  }

  validateAmount() {
    const input = this.querySelector('#amount-input');
    this.amount = input?.value || '';
    
    // Update total
    const total = this.querySelector('#total-amount');
    if (total && this.amount) {
      total.textContent = `${this.amount} ${this.selectedAsset}`;
    }
    
    this.checkFormValidity();
  }

  checkFormValidity() {
    const hasAddress = this.recipient.length > 0;
    const hasAmount = parseFloat(this.amount) > 0;
    const btn = this.querySelector('#btn-review');
    
    this.isValid = hasAddress && hasAmount;
    
    if (btn) {
      btn.disabled = !this.isValid;
    }
  }
}

customElements.define('send-form', SendForm);

export { SendForm };
