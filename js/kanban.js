/**
 * HIGHER CRM — KANBAN MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';

export const KANBAN = {
  async load(projectId) {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    this.showSkeletons(board);

    try {
      const [{ data: columns }, { data: tasks }] = await Promise.all([
        APP.db.from('kanban_columns').select('*').eq('project_id', projectId).order('position'),
        APP.db.from('tasks').select('*').eq('project_id', projectId).order('position')
      ]);

      APP.data.columns = columns || [];
      APP.data.tasks = tasks || [];

      this.render(board);
    } catch (err) {
      console.error('[Kanban]', err);
      board.innerHTML = '<div class="kanban-empty">Erro ao carregar board.</div>';
    }
  },

  showSkeletons(board) {
    board.innerHTML = Array(3).fill(0).map(() => `
      <div class="kanban-column">
        <div class="skeleton skeleton-row" style="margin-bottom:1rem"></div>
        <div class="skeleton skeleton-card" style="height:100px; margin-bottom:1rem"></div>
        <div class="skeleton skeleton-card" style="height:100px"></div>
      </div>
    `).join('');
  },

  render(board) {
    if (!APP.data.columns.length) {
      board.innerHTML = '<div class="kanban-empty">Nenhuma coluna configurada para este projeto.</div>';
      return;
    }

    board.innerHTML = APP.data.columns.map(col => {
      const colTasks = APP.data.tasks.filter(t => t.column_id === col.id);
      return `
        <div class="kanban-column" data-id="${col.id}">
          <div class="kanban-column-header">
            <h4 class="kanban-column-title">${UTILS.escHtml(col.name)}</h4>
            <span class="kanban-column-count">${colTasks.length}</span>
          </div>
          <div class="kanban-tasks" id="col-${col.id}">
            ${colTasks.map(t => this.renderTaskCard(t)).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  renderTaskCard(t) {
    return `
      <div class="task-card" onclick="openTaskModal('${t.id}')">
        <div class="task-card-header">
          <span class="task-priority ${t.priority || 'medium'}"></span>
        </div>
        <div class="task-card-title">${UTILS.escHtml(t.title)}</div>
        <div class="task-card-footer">
          ${t.due_date ? `<span class="task-due">📅 ${UTILS.formatDate(t.due_date, true)}</span>` : ''}
        </div>
      </div>
    `;
  },

  openTaskModal(editId = null) {
    try {
    APP.editing.taskId = editId;
    const form = document.getElementById('task-form');
    if (!form) return;
    form.reset();

    const colSel = document.getElementById('tf-column');
    colSel.innerHTML = APP.data.columns.map(c => `<option value="${c.id}">${UTILS.escHtml(c.name)}</option>`).join('');

      if (editId) {
        const t = APP.data.tasks.find(tk => tk.id === editId);
        if (!t) return;
        document.getElementById('task-modal-title').textContent = '✏️ Editar Tarefa';
        document.getElementById('task-id').value = t.id;
        document.getElementById('tf-title').value = t.title || '';
        document.getElementById('tf-column').value = t.column_id || '';
        document.getElementById('tf-priority').value = t.priority || 'medium';
        document.getElementById('tf-description').value = t.description || '';
        
        // Render Checklist
        this.renderChecklist(t.checklist || []);
        // Render Attachments
        this.renderAttachments(t.attachments || []);
      } else {
        document.getElementById('task-modal-title').textContent = '📝 Nova Tarefa';
        document.getElementById('task-project-id').value = APP.kanban.selectedProjectId;
        this.renderChecklist([]);
        this.renderAttachments([]);
      }
      UTILS.openModal('modal-task');
    } catch (err) {
      console.error('[Kanban Modal]', err);
    }
  },

  renderChecklist(items) {
    const container = document.getElementById('tf-checklist-container');
    if (!container) return;
    container.innerHTML = items.map((item, idx) => `
      <div class="checklist-item" style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem; align-items: center; animation: modal-up 0.2s ease;">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleCheckItem(${idx})" style="flex-shrink:0" />
        <input type="text" class="input-clean" value="${UTILS.escHtml(item.text)}" onchange="updateCheckItem(${idx}, this.value)" placeholder="Escreva um item..." style="flex:1" />
        <button type="button" class="btn-icon btn-sm" onclick="removeCheckItem(${idx})" style="opacity:0.4">✕</button>
      </div>
    `).join('');
    this.tempChecklist = items;
    this.updateChecklistProgress();
  },

  updateChecklistProgress() {
    const list = KANBAN.tempChecklist || [];
    const total = list.length;
    const done = list.filter(i => !!i.done).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    
    const bar = document.getElementById('tf-checklist-progress-bar');
    const text = document.getElementById('tf-checklist-progress-text');
    if (bar) bar.style.width = `${pct}%`;
    if (text) text.textContent = `${pct}%`;
  },

  addChecklistItem() {
    this.tempChecklist = this.tempChecklist || [];
    this.tempChecklist.push({ text: '', done: false });
    this.renderChecklist(this.tempChecklist);
  },

  updateCheckItem(idx, val) { KANBAN.tempChecklist[idx].text = val; KANBAN.updateChecklistProgress(); },
  toggleCheckItem(idx) { KANBAN.tempChecklist[idx].done = !KANBAN.tempChecklist[idx].done; KANBAN.updateChecklistProgress(); },
  removeCheckItem(idx) { KANBAN.tempChecklist.splice(idx, 1); KANBAN.renderChecklist(KANBAN.tempChecklist); },

  renderAttachments(items) {
    const container = document.getElementById('tf-attachments-container');
    if (!container) return;
    container.innerHTML = items.map((item, idx) => `
      <div class="attachment-item" style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem; align-items: center; animation: modal-up 0.2s ease;">
        <div style="width: 30px; height: 30px; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">🔗</div>
        <input type="text" class="input-clean" placeholder="Nome (Ex: Figma)" value="${UTILS.escHtml(item.name)}" onchange="addAttachmentItem_Update(${idx}, 'name', this.value)" style="width: 25%" />
        <input type="text" class="input-clean" placeholder="Cole a URL aqui..." value="${UTILS.escHtml(item.url)}" onchange="addAttachmentItem_Update(${idx}, 'url', this.value)" style="flex:1" />
        <button type="button" class="btn-icon btn-sm" onclick="removeAttachmentItem(${idx})" style="opacity:0.4">✕</button>
      </div>
    `).join('');
    this.tempAttachments = items;
  },

  addAttachmentItem() {
    this.tempAttachments = this.tempAttachments || [];
    this.tempAttachments.push({ name: '', url: '' });
    this.renderAttachments(this.tempAttachments);
  },

  updateAttachment(idx, field, val) { this.tempAttachments[idx][field] = val; },
  removeAttachment(idx) { this.tempAttachments.splice(idx, 1); this.renderAttachments(this.tempAttachments); },

  async save(e) {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const payload = {
      title:       document.getElementById('tf-title').value.trim(),
      column_id:   document.getElementById('tf-column').value,
      priority:    document.getElementById('tf-priority').value,
      description: document.getElementById('tf-description').value.trim(),
      checklist:   this.tempChecklist || [],
      attachments: this.tempAttachments || [],
      project_id:  APP.kanban.selectedProjectId,
    };

    if (!payload.title || !payload.column_id) { UTILS.toast('Título é obrigatório', 'error'); return; }

    const btn = document.getElementById('btn-save-task');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
      let error;
      if (id) {
        ({ error } = await APP.db.from('tasks').update(payload).eq('id', id));
      } else {
        ({ error } = await APP.db.from('tasks').insert([payload]));
      }

      if (error) throw error;
      
      UTILS.toast(id ? 'Tarefa atualizada!' : 'Tarefa criada!', 'success');
      UTILS.closeModal('modal-task');
      await this.load(APP.kanban.selectedProjectId);
    } catch (err) {
      console.error("Save Task Error:", err);
      UTILS.toast('Erro ao salvar tarefa: ' + (err.message || 'Desconhecido'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar Tarefa'; }
    }
  }
};

// Global Exposure
window.loadKanban = (projectId) => KANBAN.load(projectId);
window.openTaskModal = (id) => KANBAN.openTaskModal(id);
window.handleSaveTask = (e) => KANBAN.save(e);
window.addChecklistItem = () => KANBAN.addChecklistItem();
window.addAttachmentItem = () => KANBAN.addAttachmentItem();

// Internal helpers exposure
window.toggleCheckItem = (idx) => KANBAN.toggleCheckItem(idx);
window.updateCheckItem = (idx, val) => KANBAN.updateCheckItem(idx, val);
window.removeCheckItem = (idx) => KANBAN.removeCheckItem(idx);
window.addAttachmentItem_Update = (idx, field, val) => KANBAN.updateAttachment(idx, field, val);
window.removeAttachmentItem = (idx) => KANBAN.removeAttachment(idx);
