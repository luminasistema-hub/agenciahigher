/**
 * HIGHER CRM — REALTIME MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';
import { LEADS } from './leads.js';
import { CONTACTS } from './contacts.js';
import { DASHBOARD } from './dashboard.js';

export const REALTIME = {
  start() {
    // ── NEW LEAD from quiz ────────────────────────────────────
    APP.db
      .channel('public:leads')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
      }, (payload) => {
        const lead = payload.new;
        APP.data.leads.unshift(lead);
        LEADS.render();
        DASHBOARD.load();

        const newCount = APP.data.leads.filter(l => l.status === 'new').length;
        const badge = document.getElementById('leads-badge');
        if (badge) {
          badge.textContent = newCount;
          badge.style.display = newCount > 0 ? 'inline-block' : 'none';
        }

        this.toastLead(lead);

        const navLeads = document.getElementById('nav-leads');
        if (navLeads) {
          navLeads.style.setProperty('background', 'rgba(255,107,26,0.18)');
          setTimeout(() => navLeads.style.removeProperty('background'), 2500);
        }
      })
      .subscribe();

    // ── NEW CONTACT from site form ────────────────────────────
    APP.db
      .channel('public:contacts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contacts',
      }, (payload) => {
        APP.data.contacts.unshift(payload.new);
        CONTACTS.render();
        UTILS.toast(`✉️ Novo contato de ${payload.new.name}!`, 'info');
      })
      .subscribe();

    console.log('[CRM] 🔴 Realtime ativo — escutando leads e contatos em tempo real!');
  },

  toastLead(lead) {
    const planColors = { starter: '#22C55E', growth: '#F59E0B', pro: '#FC5130' };
    const color = planColors[lead.recommended_plan] || '#FF6B1A';
    const el = document.createElement('div');
    el.style.cssText = `
      background: var(--bg-card);
      border: 1px solid ${color};
      border-left: 4px solid ${color};
      border-radius: 10px;
      padding: 0.85rem 1.1rem;
      font-size: 0.85rem;
      color: var(--text-1);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}33;
      display: flex; flex-direction: column; gap: 0.3rem;
      animation: toast-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
      max-width: 320px; cursor: pointer;
      position: relative; z-index: 9999;
    `;
    el.innerHTML = `
      <div style="font-weight:700;display:flex;align-items:center;gap:0.5rem">
        <span style="font-size:1.1rem">🎯</span>
        <span>Novo Lead do Quiz!</span>
      </div>
      <div style="color:var(--text-2);font-size:0.8rem">
        <strong>${UTILS.escHtml(lead.name)}</strong> — ${UTILS.planLabel(lead.recommended_plan)} · Score: ${lead.score}/100
      </div>
      <div style="color:var(--text-3);font-size:0.72rem">${UTILS.escHtml(lead.business_name || lead.whatsapp)}</div>
      <div style="font-size:0.72rem;color:${color};margin-top:0.2rem">Clique para ver detalhes →</div>
    `;
    el.addEventListener('click', () => {
      if (window.switchView) window.switchView('leads');
      el.remove();
    });
    document.getElementById('toast-container')?.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) {
        el.style.animation = 'toast-out 0.3s ease forwards';
        setTimeout(() => el.remove(), 350);
      }
    }, 8000);
  }
};

// Global Exposure
window.startRealtime = () => REALTIME.start();
