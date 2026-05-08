/**
 * HIGHER CRM — CONTACTS MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';

export const CONTACTS = {
  async load() {
    const { data, error } = await APP.db
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    APP.data.contacts = data || [];
    this.render();
  },

  render() {
    const tbody = document.getElementById('contacts-tbody');
    if (!tbody) return;

    if (!APP.data.contacts.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Nenhum contato encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = APP.data.contacts.map(c => `
      <tr>
        <td class="td-name">${UTILS.escHtml(c.name)}</td>
        <td>${UTILS.escHtml(c.email)}</td>
        <td style="color:var(--text-3)">${UTILS.formatDate(c.created_at)}</td>
        <td><span class="badge badge-${c.status}">${UTILS.statusLabel(c.status)}</span></td>
        <td>
          <div class="td-actions">
             <button class="btn-icon" title="Marcar como lido" onclick="markContactRead('${c.id}')">✔️</button>
             <a href="mailto:${c.email}" class="btn-icon" title="Responder e-mail">✉️</a>
          </div>
        </td>
      </tr>
    `).join('');
  },

  async markRead(id) {
    const { error } = await APP.db.from('contacts').update({ status: 'read' }).eq('id', id);
    if (error) { UTILS.toast('Erro ao atualizar status', 'error'); return; }
    const contact = APP.data.contacts.find(c => c.id === id);
    if (contact) contact.status = 'read';
    this.render();
    UTILS.toast('Contato marcado como lido', 'success');
  }
};

// Global Exposure
window.markContactRead = (id) => CONTACTS.markRead(id);
