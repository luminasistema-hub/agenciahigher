/**
 * HIGHER CRM — UTILS MODULE
 * Shared helper functions for UI, formatting and state
 */

export const UTILS = {
  /**
   * Safe HTML escaping to prevent XSS
   */
  escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ 
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
    }[c]));
  },

  /**
   * Format date to Brazilian format (PT-BR)
   */
  formatDate(d, short = false) {
    if (!d) return '—';
    const date = new Date(d);
    if (short) return date.toLocaleDateString('pt-BR');
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  /**
   * Currency formatter for BRL
   */
  formatCurrency(v) {
    return 'R$ ' + (Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  },

  /**
   * Global toast notification system
   */
  toast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${this.escHtml(message)}</span>`;
    container.appendChild(el);
    
    setTimeout(() => {
      el.style.animation = 'toast-out 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  /**
   * Modal management
   */
  openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('open');
      document.body.style.overflow = '';
    }
  },

  /**
   * Get a random color from the brand palette
   */
  randomColor() {
    const colors = ['#7C3AED', '#FF6B1A', '#22C55E', '#F59E0B', '#C026D3', '#0EA5E9', '#EF4444', '#10B981'];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  /**
   * Animated counter for numbers
   */
  animCount(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    let cur = 0;
    const step = Math.max(1, Math.round(target / 30));
    const timer = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = cur;
      if (cur >= target) clearInterval(timer);
    }, 40);
  },

  /**
   * Animated counter for currency values
   */
  animCountCurrency(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    let cur = 0;
    const step = Math.max(0.1, target / 30);
    const timer = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = this.formatCurrency(cur);
      if (cur >= target) clearInterval(timer);
    }, 40);
  },

  /**
   * Labels and mapping for business logic
   */
  planLabel(p) {
    return { starter: '🪤 Starter', growth: '💎 Growth', pro: '🚀 Pro' }[p] || p || '—';
  },

  projectLabel(p) {
    return { 
      lp: '🚀 Landing Page', 
      site: '🌐 Site Institucional', 
      sistema: '⚙️ Sistema Web', 
      app: '📱 App Mobile', 
      automacao: '🤖 Automação', 
      funil: '🎯 Funil de Vendas', 
      ecommerce: '🛒 E-commerce',
      branding: '🎨 Branding'
    }[p] || p || '—';
  },

  statusLabel(s) {
    return { 
      new: '🟢 Novo', contacted: '📞 Contatado', qualified: '⭐ Qualificado',
      closed: '✅ Fechado', lost: '❌ Perdido', active: '✅ Ativo',
      paused: '⏸️ Pausado', churned: '❌ Encerrado', prospect: '🔍 Prospect',
      completed: '🏆 Concluído', cancelled: '❌ Cancelado',
      draft: '📝 Rascunho', sent: '📤 Enviada', partial: '⚡ Parcial', paid: '✅ Pago', overdue: '🔴 Vencida'
    }[s] || s || '—';
  },

  /**
   * Update the UI clock
   */
  updateClock() {
    const clockEl = document.getElementById('topbar-time');
    if (!clockEl) return;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    
    clockEl.innerHTML = `
      <span class="time">${timeStr}</span>
      <span class="date">${dateStr}</span>
    `;
  },

  /**
   * Debounce helper to limit function execution frequency
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};
