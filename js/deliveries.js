/**
 * HIGHER CRM — DELIVERIES MODULE
 * Manages official deliverables sent to the client portal
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';

export const DELIVERIES = {
  async save(e) {
    e.preventDefault();
    console.log('[Deliveries] Iniciando processo de salvamento...');
    
    const btn = document.getElementById('btn-save-delivery');
    if (btn) { 
      btn.disabled = true; 
      btn.textContent = 'Enviando...'; 
    }

    const payload = {
      project_id:   document.getElementById('df-project-id').value,
      name:         document.getElementById('df-name').value.trim(),
      description:  document.getElementById('df-description').value.trim() || null,
      delivery_url: document.getElementById('df-url').value.trim() || null,
      status:       'delivered',
      created_at:   new Date().toISOString()
    };

    console.log('[Deliveries] Payload preparado:', payload);

    if (!payload.project_id || !payload.name) {
      UTILS.toast('Projeto e nome são obrigatórios', 'error');
      this.resetButton(btn);
      return;
    }

    try {
      console.log('[Deliveries] Enviando para o Supabase...');
      const { data, error } = await APP.db.from('deliverables').insert([payload]).select();
      
      if (error) {
        console.error('[Deliveries] Erro retornado pelo Supabase:', error);
        throw error;
      }

      console.log('[Deliveries] Sucesso!', data);
      UTILS.toast('Entrega enviada para o portal!', 'success');
      UTILS.closeModal('modal-delivery');
      
      // Tentar atualizar a lista de projetos se estiver na view de projetos
      if (window.switchView) {
        // Recarregar dados para garantir sincronia
        if (window.loadAll) await window.loadAll();
      }
      
    } catch (err) {
      console.error("[Deliveries] Exception fatal:", err);
      UTILS.toast('Erro ao salvar entrega: ' + (err.message || 'Erro de conexão'), 'error');
    } finally {
      this.resetButton(btn);
    }
  },

  resetButton(btn) {
    if (btn) { 
      btn.disabled = false; 
      btn.textContent = 'Enviar para o Portal'; 
    }
  },

  async openModal(projectId) {
    const proj = APP.data.projects.find(p => p.id === projectId);
    if (!proj) return;

    document.getElementById('df-project-id').value = projectId;
    document.getElementById('delivery-form').reset();
    
    // Abrir modal primeiro para feedback visual
    UTILS.openModal('modal-delivery');
    
    // Carregar histórico
    this.renderHistory(projectId);
  },

  async renderHistory(projectId) {
    const listEl = document.getElementById('df-list');
    if (!listEl) return;

    try {
      const { data, error } = await APP.db
        .from('deliverables')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        listEl.innerHTML = '<p style="color: #444; font-size: 0.9rem;">Nenhuma entrega realizada para este projeto.</p>';
        return;
      }

      listEl.innerHTML = data.map(d => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem;">
            <div>
              <div style="font-weight: 600; font-size: 0.95rem;">${d.name}</div>
              <div style="font-size: 0.75rem; color: #666;">Enviado em: ${UTILS.formatDate(d.created_at, true)}</div>
            </div>
            <span class="badge badge-${d.status}">${UTILS.statusLabel(d.status)}</span>
          </div>
          
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            <a href="${d.delivery_url}" target="_blank" class="btn-ghost btn-sm" style="font-size: 0.65rem;">Ver Material 🔗</a>
            <button onclick="deleteDelivery('${d.id}', '${projectId}')" class="btn-ghost btn-sm" style="font-size: 0.65rem; color: #ff4d4d; border-color: rgba(255,77,77,0.2);">Excluir</button>
          </div>

          ${d.client_feedback ? `
            <div style="background: rgba(255, 107, 26, 0.05); border-left: 3px solid var(--brand-orange); padding: 0.8rem; border-radius: 4px;">
              <p style="font-size: 0.65rem; color: var(--brand-orange); font-weight: 700; margin-bottom: 0.3rem; text-transform: uppercase;">Feedback do Cliente:</p>
              <p style="font-size: 0.85rem; color: #eee; font-style: italic;">"${d.client_feedback}"</p>
              ${d.last_feedback_at ? `<p style="font-size: 0.6rem; color: #555; margin-top: 0.4rem;">Recebido em: ${UTILS.formatDate(d.last_feedback_at)}</p>` : ''}
            </div>
          ` : `
            <p style="font-size: 0.75rem; color: #444; font-style: italic;">Aguardando retorno do cliente...</p>
          `}
        </div>
      `).join('');

    } catch (err) {
      console.error('[Deliveries] Erro ao carregar histórico:', err);
      listEl.innerHTML = '<p style="color: #ff4d4d; font-size: 0.8rem;">Erro ao carregar histórico.</p>';
    }
  },

  async delete(id, projectId) {
    if (!confirm('Deseja excluir esta entrega? O cliente não terá mais acesso a ela no portal.')) return;
    try {
      const { error } = await APP.db.from('deliverables').delete().eq('id', id);
      if (error) throw error;
      UTILS.toast('Entrega excluída com sucesso!');
      this.renderHistory(projectId);
    } catch (err) {
      console.error(err);
      UTILS.toast('Erro ao excluir entrega', 'error');
    }
  }
};

// Global Exposure
window.openDeliveryModal = (projectId) => DELIVERIES.openModal(projectId);
window.handleSaveDelivery = (e) => DELIVERIES.save(e);
window.deleteDelivery = (id, projectId) => DELIVERIES.delete(id, projectId);
