/**
 * KernelWallet Lock Screen Component
 * Secure lock overlay with biometric-style animation
 */

class LockScreen extends HTMLElement {
  constructor() {
    super();
    this.attempts = 0;
    this.maxAttempts = 5;
    this.isLocked = false;
  }

  connectedCallback() {
    this.render();
    this.attachEvents();
    this.startIdleAnimation();
  }

  render() {
    this.innerHTML = `
      <div class="lock-overlay">
        <div class="lock-content">
          <!-- Animated Rings -->
          <div class="lock-rings">
            <div class="ring ring-1"></div>
            <div class="ring ring-2"></div>
            <div class="ring ring-3"></div>
            <div class="lock-icon">🔐</div>
          </div>

          <h2 class="lock-title">Wallet Locked</h2>
          <p class="lock-subtitle">Enter your password to continue</p>

          <form class="lock-form" id="lock-form">
            <div class="password-field">
              <input 
                type="password" 
                class="lock-input" 
                id="lock-password"
                placeholder="Password"
                autocomplete="off"
                required
              >
              <button type="button" class="toggle-visibility" id="toggle-visibility">👁️</button>
            </div>

            <div class="attempts-bar" id="attempts-bar">
              ${Array(5).fill(0).map((_, i) => `
                <div class="attempt-dot" data-index="${i}"></div>
              `).join('')}
            </div>

            <button type="submit" class="unlock-action" id="unlock-action">
              <span class="action-text">Unlock</span>
              <div class="action-loader hidden"></div>
            </button>
          </form>

          <div class="lock-error" id="lock-error"></div>

          <div class="lock-options">
            <button class="option-link" id="btn-forgot-lock">Forgot Password?</button>
            <span class="option-divider">•</span>
            <button class="option-link danger" id="btn-reset-lock">Reset</button>
          </div>
        </div>

        <!-- Background particles -->
        <div class="lock-particles" id="lock-particles"></div>
      </div>
    `;
    
    this.applyStyles();
    this.createParticles();
  }

  applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .lock-overlay {
        position: fixed;
        inset: 0;
        background: #050510;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        overflow: hidden;
      }

      .lock-content {
        position: relative;
        z-index: 2;
        text-align: center;
        padding: 40px;
        max-width: 360px;
        width: 100%;
      }

      .lock-rings {
        position: relative;
        width: 140px;
        height: 140px;
        margin: 0 auto 32px;
      }

      .ring {
        position: absolute;
        border-radius: 50%;
        border: 2px solid transparent;
        animation: ring-spin linear infinite;
      }

      .ring-1 {
        inset: 0;
        border-top-color: rgba(99,102,241,0.6);
        border-right-color: rgba(99,102,241,0.2);
        animation-duration: 6s;
      }

      .ring-2 {
        inset: 15px;
        border-bottom-color: rgba(139,92,246,0.5);
        border-left-color: rgba(139,92,246,0.2);
        animation-duration: 8s;
        animation-direction: reverse;
      }

      .ring-3 {
        inset: 30px;
        border-top-color: rgba(236,72,153,0.4);
        border-bottom-color: rgba(236,72,153,0.1);
        animation-duration: 10s;
      }

      @keyframes ring-spin {
        to { transform: rotate(360deg); }
      }

      .lock-icon {
        position: absolute;
        inset: 45px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        box-shadow: 0 0 40px rgba(99,102,241,0.4), inset 0 0 20px rgba(255,255,255,0.1);
        animation: icon-pulse 3s ease-in-out infinite;
      }

      @keyframes icon-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }

      .lock-title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 8px;
        background: linear-gradient(135deg, #fff, #c7d2fe);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .lock-subtitle {
        color: rgba(255,255,255,0.4);
        font-size: 14px;
        margin-bottom: 32px;
      }

      .lock-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .password-field {
        position: relative;
      }

      .lock-input {
        width: 100%;
        padding: 16px 50px 16px 20px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        color: white;
        font-size: 16px;
        outline: none;
        transition: all 0.3s;
      }

      .lock-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 4px rgba(99,102,241,0.15), 0 0 20px rgba(99,102,241,0.1);
      }

      .toggle-visibility {
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: rgba(255,255,255,0.4);
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
      }

      .attempts-bar {
        display: flex;
        justify-content: center;
        gap: 8px;
      }

      .attempt-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(255,255,255,0.1);
        transition: all 0.3s;
      }

      .attempt-dot.used {
        background: #ef4444;
        box-shadow: 0 0 8px rgba(239,68,68,0.4);
      }

      .attempt-dot.warning {
        background: #f59e0b;
        animation: dot-blink 0.5s infinite;
      }

      @keyframes dot-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      .unlock-action {
        padding: 16px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        border-radius: 16px;
        color: white;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: all 0.3s;
        box-shadow: 0 4px 20px rgba(99,102,241,0.3);
      }

      .unlock-action:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(99,102,241,0.4);
      }

      .unlock-action:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .action-loader {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: inherit;
      }

      .action-loader::after {
        content: '';
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .lock-error {
        color: #ef4444;
        font-size: 13px;
        min-height: 20px;
        margin-top: 4px;
      }

      .lock-options {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }

      .option-link {
        background: none;
        border: none;
        color: rgba(255,255,255,0.4);
        font-size: 13px;
        cursor: pointer;
        transition: color 0.2s;
      }

      .option-link:hover {
        color: #6366f1;
      }

      .option-link.danger:hover {
        color: #ef4444;
      }

      .option-divider {
        color: rgba(255,255,255,0.1);
      }

      .lock-particles {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 1;
      }

      .lock-particle {
        position: absolute;
        width: 2px;
        height: 2px;
        background: rgba(99,102,241,0.3);
        border-radius: 50%;
        animation: particle-float 10s ease-in-out infinite;
      }

      @keyframes particle-float {
        0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
        25% { transform: translateY(-30px) translateX(15px); opacity: 0.6; }
        50% { transform: translateY(-15px) translateX(-15px); opacity: 0.4; }
        75% { transform: translateY(-40px) translateX(10px); opacity: 0.5; }
      }

      .hidden { display: none !important; }
    `;
    
    this.appendChild(style);
  }

  createParticles() {
    const container = this.querySelector('#lock-particles');
    if (!container) return;
    
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      p.className = 'lock-particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.top = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 10}s`;
      p.style.animationDuration = `${8 + Math.random() * 6}s`;
      
      const size = 1 + Math.random() * 3;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      
      container.appendChild(p);
    }
  }

  attachEvents() {
    const form = this.querySelector('#lock-form');
    const toggle = this.querySelector('#toggle-visibility');
    const input = this.querySelector('#lock-password');
    
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUnlock();
    });
    
    toggle?.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = '🙈';
      } else {
        input.type = 'password';
        toggle.textContent = '👁️';
      }
    });
    
    this.querySelector('#btn-forgot-lock')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('forgot-password', { bubbles: true }));
    });
    
    this.querySelector('#btn-reset-lock')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('reset-wallet', { bubbles: true }));
    });
  }

  async handleUnlock() {
    const input = this.querySelector('#lock-password');
    const password = input?.value;
    
    if (!password) return;
    
    this.setLoading(true);
    
    try {
      const result = await this.attemptUnlock(password);
      
      if (result.success) {
        this.dispatchEvent(new CustomEvent('unlock-success', { bubbles: true }));
        this.remove();
      } else {
        this.attempts++;
        this.updateAttempts();
        this.showError(result.error || 'Incorrect password');
        
        if (this.attempts >= this.maxAttempts) {
          this.lockout();
        }
      }
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.setLoading(false);
    }
  }

  attemptUnlock(password) {
    // This would call wallet-manager.unlockVault in production
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock - always succeed for demo
        resolve({ success: true });
      }, 800);
    });
  }

  updateAttempts() {
    const dots = this.querySelectorAll('.attempt-dot');
    dots.forEach((dot, i) => {
      if (i < this.attempts) {
        dot.classList.add('used');
      }
      if (this.attempts >= 3 && i >= 3) {
        dot.classList.add('warning');
      }
    });
  }

  showError(msg) {
    const error = this.querySelector('#lock-error');
    if (error) {
      error.textContent = msg;
      error.style.animation = 'none';
      error.offsetHeight;
      error.style.animation = 'shake 0.5s ease';
    }
  }

  lockout() {
    this.isLocked = true;
    const btn = this.querySelector('#unlock-action');
    if (btn) {
      btn.disabled = true;
      btn.querySelector('.action-text').textContent = 'Locked (5 min)';
    }
    
    setTimeout(() => {
      this.isLocked = false;
      this.attempts = 0;
      if (btn) {
        btn.disabled = false;
        btn.querySelector('.action-text').textContent = 'Unlock';
      }
      this.querySelectorAll('.attempt-dot').forEach(d => {
        d.classList.remove('used', 'warning');
      });
    }, 300000); // 5 minutes
  }

  setLoading(loading) {
    const btn = this.querySelector('#unlock-action');
    const text = btn?.querySelector('.action-text');
    const loader = btn?.querySelector('.action-loader');
    
    if (loading) {
      btn.disabled = true;
      text?.classList.add('hidden');
      loader?.classList.remove('hidden');
    } else {
      btn.disabled = false;
      text?.classList.remove('hidden');
      loader?.classList.add('hidden');
    }
  }

  startIdleAnimation() {
    // Subtle animation when idle
    let idleTime = 0;
    const idleInterval = setInterval(() => {
      idleTime++;
      if (idleTime > 30 && !this.isConnected) { // 30 seconds
        // Slow down animations
        this.querySelectorAll('.ring').forEach(r => {
          r.style.animationDuration = '20s';
        });
      }
    }, 1000);
    
    this.addEventListener('mousemove', () => {
      idleTime = 0;
      this.querySelectorAll('.ring').forEach(r => {
        r.style.animationDuration = '';
      });
    });
  }
}

customElements.define('lock-screen', LockScreen);

export { LockScreen };
