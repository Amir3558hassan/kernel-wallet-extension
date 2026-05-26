/**
 * KernelWallet Transaction List Component
 * Displays transaction history with filtering and pagination
 */

class TransactionList extends HTMLElement {
  constructor() {
    super();
    this.transactions = [];
    this.filtered = [];
    this.page = 1;
    this.limit = 10;
    this.filters = {
      type: 'all', // all | send | receive
      status: 'all', // all | pending | confirmed | failed
      asset: 'all'
    };
  }

  static get observedAttributes() {
    return ['transactions'];
  }

  connectedCallback() {
    this.render();
    this.attachEvents();
  }

  setTransactions(txs) {
    this.transactions = txs || [];
    this.applyFilters();
    this.renderList();
  }

  render() {
    this.innerHTML = `
      <div class="tx-list-container">
        <div class="tx-filters">
          <div class="filter-group">
            <button class="filter-btn active" data-filter="type" data-value="all">All</button>
            <button class="filter-btn" data-filter="type" data-value="send">Sent</button>
            <button class="filter-btn" data-filter="type" data-value="receive">Received</button>
          </div>
          
          <div class="filter-group">
            <button class="filter-btn active" data-filter="status" data-value="all">All</button>
            <button class="filter-btn" data-filter="status" data-value="pending">Pending</button>
            <button class="filter-btn" data-filter="status" data-value="confirmed">Done</button>
          </div>
        </div>

        <div class="tx-search">
          <input type="text" class="search-input" id="tx-search" placeholder="Search by address or hash...">
          <span class="search-icon">🔍</span>
        </div>

        <div class="tx-items" id="tx-items">
          <div class="tx-empty">
            <div class="empty-icon">📭</div>
            <p>No transactions yet</p>
          </div>
        </div>

        <div class="tx-pagination hidden" id="tx-pagination">
          <button class="page-btn" id="btn-prev" disabled>←</button>
          <span class="page-info" id="page-info">1 / 1</span>
          <button class="page-btn" id="btn-next" disabled>→</button>
        </div>
      </div>
    `;
    
    this.applyStyles();
  }

  applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .tx-list-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }

      .tx-filters {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .filter-group {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
      }

      .filter-btn {
        padding: 6px 14px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        color: rgba(255,255,255,0.5);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .filter-btn:hover {
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.8);
      }

      .filter-btn.active {
        background: rgba(99,102,241,0.15);
        border-color: rgba(99,102,241,0.3);
        color: #a5b4fc;
      }

      .tx-search {
        position: relative;
      }

      .search-input {
        width: 100%;
        padding: 12px 40px 12px 16px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        color: white;
        font-size: 14px;
        outline: none;
        transition: all 0.3s;
      }

      .search-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 4px rgba(99,102,241,0.1);
      }

      .search-icon {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 16px;
        opacity: 0.5;
      }

      .tx-items {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tx-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s;
        animation: slideIn 0.3s ease;
      }

      @keyframes slideIn {
        from { opacity: 0; transform: translateX(-10px); }
        to { opacity: 1; transform: translateX(0); }
      }

      .tx-item:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,255,255,0.1);
        transform: translateX(4px);
      }

      .tx-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }

      .tx-icon.send {
        background: rgba(239,68,68,0.15);
        color: #ef4444;
      }

      .tx-icon.receive {
        background: rgba(34,197,94,0.15);
        color: #22c55e;
      }

      .tx-icon.pending {
        background: rgba(245,158,11,0.15);
        color: #f59e0b;
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      .tx-details {
        flex: 1;
        min-width: 0;
      }

      .tx-title {
        font-size: 14px;
        font-weight: 600;
        color: white;
        margin-bottom: 2px;
      }

      .tx-subtitle {
        font-size: 12px;
        color: rgba(255,255,255,0.4);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tx-amount {
        text-align: right;
        flex-shrink: 0;
      }

      .tx-value {
        font-size: 15px;
        font-weight: 600;
      }

      .tx-value.send {
        color: #ef4444;
      }

      .tx-value.receive {
        color: #22c55e;
      }

      .tx-status {
        font-size: 11px;
        color: rgba(255,255,255,0.4);
        margin-top: 2px;
      }

      .tx-empty {
        text-align: center;
        padding: 40px;
        color: rgba(255,255,255,0.3);
      }

      .empty-icon {
        font-size: 40px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      .tx-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 8px;
      }

      .page-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.6);
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .page-btn:hover:not(:disabled) {
        background: rgba(255,255,255,0.08);
        color: white;
      }

      .page-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .page-info {
        font-size: 14px;
        color: rgba(255,255,255,0.5);
      }

      .hidden { display: none !important; }
    `;
    
    this.appendChild(style);
  }

  attachEvents() {
    // Filter buttons
    this.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        const value = btn.dataset.value;
        
        // Update active state
        this.querySelectorAll(`.filter-btn[data-filter="${filter}"]`).forEach(b => {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        
        // Apply filter
        this.filters[filter] = value;
        this.page = 1;
        this.applyFilters();
        this.renderList();
      });
    });
    
    // Search
    const searchInput = this.querySelector('#tx-search');
    searchInput?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.page = 1;
      this.applyFilters();
      this.renderList();
    });
    
    // Pagination
    this.querySelector('#btn-prev')?.addEventListener('click', () => {
      if (this.page > 1) {
        this.page--;
        this.renderList();
      }
    });
    
    this.querySelector('#btn-next')?.addEventListener('click', () => {
      const totalPages = Math.ceil(this.filtered.length / this.limit);
      if (this.page < totalPages) {
        this.page++;
        this.renderList();
      }
    });
  }

  applyFilters() {
    this.filtered = this.transactions.filter(tx => {
      // Type filter
      if (this.filters.type !== 'all') {
        const direction = this.filters.type === 'send' ? 'outgoing' : 'incoming';
        if (tx.direction !== direction) return false;
      }
      
      // Status filter
      if (this.filters.status !== 'all') {
        if (tx.status !== this.filters.status) return false;
      }
      
      // Search
      if (this.searchTerm) {
        const searchable = [
          tx.to,
          tx.from,
          tx.txHash,
          tx.asset
        ].join(' ').toLowerCase();
        
        if (!searchable.includes(this.searchTerm)) return false;
      }
      
      return true;
    });
  }

  renderList() {
    const container = this.querySelector('#tx-items');
    const pagination = this.querySelector('#tx-pagination');
    
    if (!container) return;
    
    if (this.filtered.length === 0) {
      container.innerHTML = `
        <div class="tx-empty">
          <div class="empty-icon">📭</div>
          <p>No transactions found</p>
        </div>
      `;
      pagination?.classList.add('hidden');
      return;
    }
    
    // Pagination
    const totalPages = Math.ceil(this.filtered.length / this.limit);
    const start = (this.page - 1) * this.limit;
    const pageItems = this.filtered.slice(start, start + this.limit);
    
    container.innerHTML = '';
    
    for (const tx of pageItems) {
      const item = this.createTransactionItem(tx);
      container.appendChild(item);
    }
    
    // Update pagination
    if (pagination) {
      pagination.classList.toggle('hidden', totalPages <= 1);
      
      const pageInfo = this.querySelector('#page-info');
      const btnPrev = this.querySelector('#btn-prev');
      const btnNext = this.querySelector('#btn-next');
      
      if (pageInfo) pageInfo.textContent = `${this.page} / ${totalPages}`;
      if (btnPrev) btnPrev.disabled = this.page <= 1;
      if (btnNext) btnNext.disabled = this.page >= totalPages;
    }
  }

  createTransactionItem(tx) {
    const div = document.createElement('div');
    div.className = 'tx-item';
    
    const isSend = tx.direction === 'outgoing';
    const icon = isSend ? '↑' : '↓';
    const iconClass = tx.status === 'pending' ? 'pending' : (isSend ? 'send' : 'receive');
    const valueClass = isSend ? 'send' : 'receive';
    const sign = isSend ? '-' : '+';
    
    const timeAgo = this.formatTimeAgo(tx.timestamp);
    
    div.innerHTML = `
      <div class="tx-icon ${iconClass}">${icon}</div>
      <div class="tx-details">
        <div class="tx-title">${isSend ? 'Sent' : 'Received'} ${tx.asset}</div>
        <div class="tx-subtitle">${this.shortenAddress(tx.to)} • ${timeAgo}</div>
      </div>
      <div class="tx-amount">
        <div class="tx-value ${valueClass}">${sign}${tx.amount}</div>
        <div class="tx-status">${tx.status}</div>
      </div>
    `;
    
    div.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('tx-click', {
        detail: { transaction: tx },
        bubbles: true
      }));
    });
    
    return div;
  }

  shortenAddress(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  }
}

customElements.define('transaction-list', TransactionList);

export { TransactionList };
