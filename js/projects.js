/**
 * HIGHER CRM — PROJECTS MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';

export const PROJECTS = {
  async load() {
    this.showSkeletons();
    const { data, error } = await APP.db
      .from('projects')
      .select('*, clients(name, company)')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    APP.data.projects = data || [];
    this.render();
    this.populateSelects();
  },

  showSkeletons() {
    const list = document.getElementById('projects-list');
    if (!list) return;
    list.innerHTML = Array(4).fill(0).map(() => `<div class="skeleton skeleton-row" style="height:80px"></div>`).join('');
  },

  render() {
    const search = document.getElementById('projects-search')?.value.toLowerCase() || '';
    const projects = APP.data.projects.filter(p => {
      const clientName = p.clients?.name || '';
      return !search || p.name?.toLowerCase().includes(search) || clientName.toLowerCase().includes(search);
    });

    const list = document.getElementById('projects-list');
    if (!list) return;
    
    if (!projects.length) {
      list.innerHTML = '<div class="mini-list-loading">Nenhum projeto encontrado.</div>';
      return;
    }

    list.innerHTML = projects.map(p => `
      <div class="project-item" onclick="openKanbanForProject('${p.id}')">
        <div class="project-color-bar" style="background:${p.color || '#FF6B1A'}"></div>
        <div class="project-info">
          <div class="project-name">${UTILS.escHtml(p.name)}</div>
          <div class="project-client">👤 ${UTILS.escHtml(p.clients?.name || 'Cliente não encontrado')}</div>
        </div>
        <div class="project-meta">
          ${p.plan ? `<span class="badge badge-${p.plan}">${UTILS.planLabel(p.plan)}</span>` : ''}
          <span class="badge badge-${p.status}">${UTILS.statusLabel(p.status)}</span>
          <div class="project-progress-wrap">
            <div class="project-progress-bar"><div class="project-progress-fill" style="width:${p.progress || 0}%"></div></div>
            <span class="project-progress-pct">${p.progress || 0}%</span>
          </div>
          ${p.deadline ? `<span class="project-deadline">📅 ${UTILS.formatDate(p.deadline, true)}</span>` : ''}
        </div>
        <div class="td-actions" onclick="event.stopPropagation()">
          <button class="btn-icon" title="Entregar Material" onclick="openDeliveryModal('${p.id}')">📦</button>
          <button class="btn-icon" title="Editar" onclick="openProjectModal(null,'${p.id}')">✏️</button>
          <button class="btn-icon" title="Ver Kanban" onclick="openKanbanForProject('${p.id}')">📋</button>
          <button class="btn-icon" title="Excluir" onclick="deleteProject('${p.id}')" style="color:var(--brand-red)">🗑️</button>
        </div>
      </div>
    `).join('');
  },

  openModal(clientId = null, editId = null) {
    APP.editing.projectId = editId;
    const form = document.getElementById('project-form');
    if (!form) return;
    form.reset();

    // Re-populate client select just in case
    if (window.CLIENTS && window.CLIENTS.populateSelects) window.CLIENTS.populateSelects();

    if (editId) {
      const p = APP.data.projects.find(p => p.id === editId);
      if (!p) return;
      document.getElementById('project-modal-title').textContent = '✏️ Editar Projeto';
      document.getElementById('project-id').value = p.id;
      document.getElementById('pf-name').value = p.name || '';
      document.getElementById('pf-client').value = p.client_id || '';
      document.getElementById('pf-plan').value = p.plan || '';
      document.getElementById('pf-deadline').value = p.deadline || '';
      document.getElementById('pf-status').value = p.status || 'active';
      document.getElementById('pf-progress').value = p.progress || 0;
      const descEl = document.getElementById('pf-description');
      if (descEl) descEl.value = p.description || '';
    } else {
      document.getElementById('project-modal-title').textContent = '🚀 Novo Projeto';
      if (clientId) document.getElementById('pf-client').value = clientId;
    }
    UTILS.openModal('modal-project');
  },

  async save(e) {
    e.preventDefault();
    const id = document.getElementById('project-id').value;
    const payload = {
      name:        document.getElementById('pf-name').value.trim(),
      client_id:   document.getElementById('pf-client').value,
      plan:        document.getElementById('pf-plan').value || null,
      deadline:    document.getElementById('pf-deadline').value || null,
      status:      document.getElementById('pf-status').value,
      progress:    parseInt(document.getElementById('pf-progress').value) || 0,
      description: document.getElementById('pf-description')?.value.trim() || null,
      color:       UTILS.randomColor(),
    };

    if (!payload.name || !payload.client_id) { UTILS.toast('Nome e cliente são obrigatórios', 'error'); return; }

    const btn = document.getElementById('btn-save-project');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
      let data, error;
      if (id) {
        ({ error } = await APP.db.from('projects').update(payload).eq('id', id));
      } else {
        ({ data, error } = await APP.db.from('projects').insert([payload]).select().single());
        if (!error && data) {
          // create default kanban columns
          await APP.db.rpc('create_default_columns', { p_project_id: data.id });
        }
      }

      if (error) throw error;
      
      UTILS.toast(id ? 'Projeto atualizado!' : 'Projeto criado com colunas Kanban!', 'success');
      UTILS.closeModal('modal-project');
      await this.load();
    } catch (err) {
      console.error("Save Project Error:", err);
      UTILS.toast('Erro ao salvar projeto: ' + (err.message || 'Desconhecido'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar Projeto'; }
    }
  },

  populateSelects() {
    const sel = document.getElementById('kanban-project-select');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Selecione um projeto...</option>' +
      APP.data.projects.map(p => {
        const client = APP.data.clients.find(c => c.id === p.client_id);
        return `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${UTILS.escHtml(p.name)}${client ? ` — ${UTILS.escHtml(client.name)}` : ''}</option>`;
      }).join('');
  },

  async delete(id) {
    if (!confirm('Deseja excluir este projeto e todas as suas tarefas vinculadas?')) return;
    try {
      const { error } = await APP.db.from('projects').delete().eq('id', id);
      if (error) throw error;
      UTILS.toast('Projeto excluído com sucesso!');
      await this.load();
    } catch (err) {
      console.error(err);
      UTILS.toast('Erro ao excluir projeto', 'error');
    }
  }
};

// Global Exposure
window.openProjectModal = (clientId, id) => PROJECTS.openModal(clientId, id);
window.handleSaveProject = (e) => PROJECTS.save(e);
window.deleteProject = (id) => PROJECTS.delete(id);
window.renderProjects = () => PROJECTS.render();
window.openKanbanForProject = (projectId) => {
  if (window.switchView) window.switchView('kanban');
  const sel = document.getElementById('kanban-project-select');
  if (sel) {
    sel.value = projectId;
    APP.kanban.selectedProjectId = projectId;
    const btn = document.getElementById('btn-new-task');
    if (btn) btn.disabled = false;
    // Trigger kanban load if available
    if (window.loadKanban) window.loadKanban(projectId);
  }
};
