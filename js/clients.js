/**
 * HIGHER CRM — CLIENTS MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';

export const CLIENTS = {
  async load() {
    this.showSkeletons();
    const { data, error } = await APP.db
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    APP.data.clients = data || [];
    this.render();
    this.populateSelects();
  },

  showSkeletons() {
    const grid = document.getElementById('clients-grid');
    if (!grid) return;
    grid.innerHTML = Array(6).fill(0).map(() => `<div class="skeleton skeleton-card"></div>`).join('');
  },

  render() {
    const search = document.getElementById('clients-search')?.value.toLowerCase() || '';
    const clients = APP.data.clients.filter(c =>
      !search || c.name?.toLowerCase().includes(search) || c.company?.toLowerCase().includes(search)
    );

    const grid = document.getElementById('clients-grid');
    if (!grid) return;
    
    if (!clients.length) {
      grid.innerHTML = '<div class="mini-list-loading">Nenhum cliente encontrado. Clique em "+ Novo Cliente" para adicionar.</div>';
      return;
    }

    grid.innerHTML = clients.map(c => {
      const initials = (c.name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
      const projectCount = APP.data.projects.filter(p => p.client_id === c.id).length;
      return `
        <div class="client-card">
          <div class="client-card-top">
            <div class="client-avatar" style="background:${c.avatar_color || '#FC5130'}">${initials}</div>
            <div class="client-card-info">
              <div class="client-name">${UTILS.escHtml(c.name)}</div>
              <div class="client-company">${UTILS.escHtml(c.company || 'Sem empresa')}</div>
            </div>
          </div>
          <div class="client-card-meta">
            <span class="badge badge-${c.status}">${UTILS.statusLabel(c.status)}</span>
            ${c.plan ? `<span class="badge badge-${c.plan}">${UTILS.planLabel(c.plan)}</span>` : ''}
          </div>
          <div class="client-card-actions">
            <button class="btn-icon" title="WhatsApp" onclick="window.open('https://wa.me/${(c.whatsapp||'').replace(/\D/g,'')}','_blank')">💬</button>
            <button class="btn-icon" title="Sincronizar Asaas" onclick="syncCustomerWithAsaas('${c.id}')">${c.asaas_customer_id ? '🔄' : '☁️'}</button>
            <button class="btn-icon" title="Enviar Notificação" onclick="openNotifyModal('${c.id}')">🔔</button>
            <button class="btn-icon" title="Editar" onclick="openClientModal(null, '${c.id}')">✏️</button>
            <button class="btn-icon" title="Ver projetos" onclick="filterProjectsByClient('${c.id}')">📋</button>
            <button class="btn-icon" title="Novo projeto" onclick="openProjectModal('${c.id}')">🚀</button>
          </div>
          <div class="client-projects">${projectCount} projeto${projectCount !== 1 ? 's' : ''}</div>
        </div>
      `;
    }).join('');
  },

  openModal(prefill = null, editId = null) {
    APP.editing.clientId = editId;
    const form = document.getElementById('client-form');
    if (!form) return;
    form.reset();

    if (editId) {
      const c = APP.data.clients.find(c => c.id === editId);
      if (!c) return;
      document.getElementById('client-modal-title').textContent = '✏️ Editar Cliente';
      document.getElementById('client-id').value = c.id;
      document.getElementById('cf-name').value = c.name || '';
      document.getElementById('cf-company').value = c.company || '';
      document.getElementById('cf-email').value = c.email || '';
      document.getElementById('cf-whatsapp').value = c.whatsapp || '';
      if(document.getElementById('cf-document')) document.getElementById('cf-document').value = c.document || '';
      if(document.getElementById('cf-postalcode')) document.getElementById('cf-postalcode').value = c.postal_code || '';
      if(document.getElementById('cf-number')) document.getElementById('cf-number').value = c.address_number || '';
      document.getElementById('cf-plan').value = c.plan || '';
      document.getElementById('cf-status').value = c.status || 'active';
      // Notes field might be missing in some versions but good to have
      const notesEl = document.getElementById('cf-notes');
      if (notesEl) notesEl.value = c.notes || '';
    } else if (prefill) {
      document.getElementById('client-modal-title').textContent = '👤 Novo Cliente';
      document.getElementById('cf-name').value = prefill.name || '';
      document.getElementById('cf-email').value = prefill.email || '';
      document.getElementById('cf-whatsapp').value = prefill.whatsapp || '';
      if(document.getElementById('cf-document')) document.getElementById('cf-document').value = prefill.document || '';
      document.getElementById('cf-plan').value = prefill.plan || '';
    } else {
      document.getElementById('client-modal-title').textContent = '👤 Novo Cliente';
    }
    UTILS.openModal('modal-client');
  },

  async save(e) {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const payload = {
      name:    document.getElementById('cf-name')?.value.trim(),
      company: document.getElementById('cf-company')?.value.trim() || null,
      email:   document.getElementById('cf-email')?.value.trim() || null,
      whatsapp: document.getElementById('cf-whatsapp')?.value.trim() || null,
      document: document.getElementById('cf-document') ? (document.getElementById('cf-document').value.replace(/\D/g, '') || null) : null,
      postal_code: document.getElementById('cf-postalcode') ? (document.getElementById('cf-postalcode').value.replace(/\D/g, '') || null) : null,
      address_number: document.getElementById('cf-number') ? (document.getElementById('cf-number').value.trim() || null) : null,
      plan:    document.getElementById('cf-plan')?.value || null,
      status:  document.getElementById('cf-status')?.value || 'active',
      avatar_color: UTILS.randomColor(),
    };

    if (!payload.name) { UTILS.toast('Nome é obrigatório', 'error'); return; }

    const btn = document.getElementById('btn-save-client');
    if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

    try {
      let errorObj;
      if (id) {
        const { error } = await APP.db.from('clients').upsert({ id, ...payload });
        errorObj = error;
      } else {
        const { error } = await APP.db.from('clients').insert([payload]);
        errorObj = error;
      }

      if (errorObj) throw errorObj;
      
      UTILS.toast(id ? 'Cliente atualizado!' : 'Cliente criado!', 'success');
      UTILS.closeModal('modal-client');
      await this.load();
    } catch (err) {
      console.error("Save Client Error:", err);
      UTILS.toast('Erro ao salvar cliente: ' + (err.message || 'Desconhecido'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar Cliente'; }
    }
  },

  populateSelects() {
    const selects = ['pf-client', 'inv-client', 'fin-filter-client'];
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const current = sel.value;
      const options = APP.data.clients.map(c => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${UTILS.escHtml(c.name)}${c.company ? ` — ${UTILS.escHtml(c.company)}` : ''}</option>`);
      sel.innerHTML = (id.includes('filter') ? '<option value="">Todos Clientes</option>' : '<option value="">Selecione o cliente...</option>') + options.join('');
    });
  },

  notify(clientId) {
    const c = APP.data.clients.find(cli => cli.id === clientId);
    if (!c) return;
    const title = prompt(`Enviar notificação para ${c.name}:\n\nTítulo:`);
    if (!title) return;
    const msg = prompt('Mensagem:');
    if (!msg) return;

    APP.db.from('notifications').insert([{
      client_id: clientId,
      title: title,
      message: msg,
      type: 'info'
    }]).then(({ error }) => {
      if (error) UTILS.toast('Erro ao enviar', 'error');
      else UTILS.toast('Notificação enviada!', 'success');
    });
  }
};

// Global Exposure
window.openClientModal = (prefill, id) => CLIENTS.openModal(prefill, id);
window.handleSaveClient = (e) => CLIENTS.save(e);
window.openNotifyModal = (clientId) => CLIENTS.notify(clientId);
window.openProjectModal = (clientId, id) => PROJECTS.openModal(clientId, id);
window.handleSaveProject = (e) => PROJECTS.save(e);
window.renderProjects = () => PROJECTS.render();
window.filterProjectsByClient = (clientId) => {
  // This will be handled by the main view switcher or Projects module
  const projectsSearch = document.getElementById('projects-search');
  if (projectsSearch) {
    const client = APP.data.clients.find(c => c.id === clientId);
    if (client) projectsSearch.value = client.name;
    // Trigger projects render if available
    if (window.renderProjects) window.renderProjects();
    // Switch view (assuming global switchView exists)
    if (window.switchView) window.switchView('projects');
  }
};
