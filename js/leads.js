/**
 * HIGHER CRM — LEADS MODULE
 */
import { APP, QUESTION_MAP } from './app-state.js';
import { UTILS } from './utils.js';
import { AI_SCORER } from './ai-scoring.js';

export const LEADS = {
  async load() {
    this.showSkeletons();
    const { data, error } = await APP.db
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }
    APP.data.leads = data || [];
    this.render();

    const newCount = APP.data.leads.filter(l => l.status === 'new').length;
    const badge = document.getElementById('leads-badge');
    if (badge) {
      badge.textContent = newCount;
      badge.style.display = newCount > 0 ? 'inline-block' : 'none';
    }
  },

  showSkeletons() {
    const tbody = document.getElementById('leads-tbody');
    if (!tbody) return;
    tbody.innerHTML = Array(5).fill(0).map(() => `
      <tr>
        <td colspan="8"><div class="skeleton skeleton-row"></div></td>
      </tr>
    `).join('');
  },

  render() {
    const search = document.getElementById('leads-search')?.value.toLowerCase() || '';
    const planFilter = document.getElementById('leads-filter-plan')?.value || '';
    const statusFilter = document.getElementById('leads-filter-status')?.value || '';

    let leads = APP.data.leads.filter(l => {
      const matchSearch = !search || l.name?.toLowerCase().includes(search) || l.whatsapp?.includes(search) || l.business_name?.toLowerCase().includes(search);
      const matchPlan = !planFilter || l.recommended_plan === planFilter;
      const matchStatus = !statusFilter || l.status === statusFilter;
      return matchSearch && matchPlan && matchStatus;
    });

    const tbody = document.getElementById('leads-tbody');
    if (!tbody) return;
    
    if (!leads.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Nenhum lead encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = leads.map(l => {
      // IA Scoring Analysis
      const analysis = AI_SCORER.analyze(l);
      const heatIcon = analysis.temperature === 'hot' ? '🔥' : (analysis.temperature === 'warm' ? '☀️' : '❄️');
      const heatColor = analysis.temperature === 'hot' ? '#ff3d00' : (analysis.temperature === 'warm' ? '#ff9100' : '#2979ff');

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span title="${analysis.summary}" style="font-size:1.2rem; cursor:help;">${heatIcon}</span>
              <div>
                <strong>${UTILS.escHtml(l.name)}</strong>
                <div style="font-size:0.65rem; color:${heatColor}; font-weight:700; text-transform:uppercase;">${analysis.temperature} • ${analysis.score}/100</div>
              </div>
            </div>
          </td>
          <td><a href="https://wa.me/${l.whatsapp?.replace(/\D/g,'')}" target="_blank" style="color:#4ade80; text-decoration:none">📱 ${UTILS.escHtml(l.whatsapp)}</a></td>
          <td>${UTILS.escHtml(l.business_name || '—')}</td>
          <td><span class="project-tag">${UTILS.projectLabel(l.selected_plan || l.recommended_plan)}</span></td>
          <td><span class="badge badge-${l.status}">${UTILS.statusLabel(l.status)}</span></td>
          <td style="font-size:0.75rem; color:var(--text-3)">${UTILS.formatDate(l.created_at)}</td>
          <td>
            <div class="td-actions">
              <button class="btn-icon" title="Ver detalhes" onclick="openLeadDetail('${l.id}')">🔍</button>
              <button class="btn-icon" title="Gerar Orçamento" onclick="createBudgetFromLead('${l.id}')">📄</button>
              <a href="https://wa.me/${l.whatsapp?.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${l.name}! Sou da Agência Higher, vi que você fez nosso diagnóstico digital.`)}" target="_blank" class="btn-icon" title="WhatsApp" style="text-decoration:none;">💬</a>
              <button class="btn-icon" title="Converter em cliente" onclick="convertLeadToClient('${l.id}')">➕</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openDetail(id) {
    const lead = APP.data.leads.find(l => l.id === id);
    if (!lead) return;

    const answersHtml = lead.answers ? Object.entries(lead.answers).map(([qId, val]) => {
      const q = QUESTION_MAP[qId];
      if (!q) return '';
      
      // Suporte a múltiplos formatos (Legado: Array de índices | Novo: Objeto com label)
      let answers = '';
      if (Array.isArray(val)) {
        answers = val.map(i => `${q.options[i]?.emoji || ''} ${q.options[i]?.label || ''}`).join(', ');
      } else if (val && typeof val === 'object' && val.label) {
        answers = val.label;
      } else {
        answers = String(val);
      }

      return `
        <div class="lead-answer-item">
          <div class="lead-answer-q">${q.category} — ${q.text}</div>
          <div class="lead-answer-a">${answers}</div>
        </div>
      `;
    }).join('') : '';

    const analysis = AI_SCORER.analyze(lead);

    document.getElementById('modal-lead-body').innerHTML = `
      <div class="lead-detail-grid">
        <div class="lead-detail-field"><span class="lead-detail-label">Nome</span><span class="lead-detail-value">${UTILS.escHtml(lead.name)}</span></div>
        <div class="lead-detail-field"><span class="lead-detail-label">WhatsApp</span><span class="lead-detail-value">${UTILS.escHtml(lead.whatsapp)}</span></div>
        <div class="lead-detail-field"><span class="lead-detail-label">Empresa</span><span class="lead-detail-value">${UTILS.escHtml(lead.business_name || '—')}</span></div>
        <div class="lead-detail-field"><span class="lead-detail-label">IA Score</span><span class="lead-detail-value"><strong>${analysis.score}/100</strong> (${analysis.temperature.toUpperCase()})</span></div>
        <div class="lead-detail-field" style="grid-column: 1 / -1;"><span class="lead-detail-label">Análise da IA</span><span class="lead-detail-value" style="color:var(--brand-orange)">${analysis.summary}</span></div>
        <div class="lead-detail-field"><span class="lead-detail-label">Projeto Sugerido</span><span class="lead-detail-value"><span class="project-tag">${UTILS.projectLabel(lead.selected_plan || lead.recommended_plan)}</span></span></div>
        <div class="lead-detail-field"><span class="lead-detail-label">Data</span><span class="lead-detail-value">${UTILS.formatDate(lead.created_at)}</span></div>
      </div>
      ${answersHtml ? `<div style="margin-top:1rem"><p style="font-size:0.75rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;font-weight:600;margin-bottom:.5rem">Respostas do Quiz</p><div class="lead-answers-grid">${answersHtml}</div></div>` : ''}
      <div class="lead-detail-actions">
        <select class="lead-status-select" id="lead-status-${id}" onchange="updateLeadStatusLocal('${id}', this.value)">
          <option value="new" ${lead.status==='new'?'selected':''}>🟢 Novo</option>
          <option value="contacted" ${lead.status==='contacted'?'selected':''}>📞 Contatado</option>
          <option value="qualified" ${lead.status==='qualified'?'selected':''}>⭐ Qualificado</option>
          <option value="closed" ${lead.status==='closed'?'selected':''}>✅ Fechado</option>
          <option value="lost" ${lead.status==='lost'?'selected':''}>❌ Perdido</option>
        </select>
        <a href="https://wa.me/${lead.whatsapp?.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${lead.name}! 😊`)}" target="_blank" class="btn-primary" style="text-decoration:none">💬 WhatsApp</a>
        <button class="btn-ghost" onclick="convertLeadToClient('${id}');closeModal('modal-lead')">➕ Converter em Cliente</button>
      </div>
    `;
    UTILS.openModal('modal-lead');
  },

  async updateStatus(id, status) {
    const { error } = await APP.db.from('leads').update({ status }).eq('id', id);
    if (error) { UTILS.toast('Erro ao atualizar status', 'error'); return; }
    const lead = APP.data.leads.find(l => l.id === id);
    if (lead) lead.status = status;
    this.render();
    UTILS.toast('Status atualizado!', 'success');
  }
};

// Global Exposure
window.openLeadDetail = (id) => LEADS.openDetail(id);
window.updateLeadStatusLocal = (id, status) => LEADS.updateStatus(id, status);
window.convertLeadToClient = (id) => {
  const lead = APP.data.leads.find(l => l.id === id);
  if (lead && window.openClientModal) {
    window.openClientModal({
      name: lead.name,
      email: lead.email,
      whatsapp: lead.whatsapp,
      document: lead.document,
      plan: lead.recommended_plan,
      lead_id: id,
    });
  }
};

window.createBudgetFromLead = async (leadId) => {
  const lead = APP.data.leads.find(l => l.id === leadId);
  if (!lead) return;

  // 1. Buscar cliente existente
  let { data: client } = await APP.db.from('clients').select('*').eq('email', lead.email).maybeSingle();
  
  if (!client) {
    if (confirm(`Para gerar um orçamento, o lead "${lead.name}" precisa ser um cliente. Deseja cadastrá-lo agora?`)) {
      window.convertLeadToClient(leadId);
      return;
    }
    return;
  }

  // 2. Abrir o modal de orçamento preenchido
  if (window.openBudgetModal) {
    window.openBudgetModal({
      client_id: client.id,
      title: `Projeto: ${UTILS.projectLabel(lead.recommended_plan).toUpperCase()}`,
      notes: `Solicitação via Diagnóstico Digital:\n"${lead.project_details || 'Sem detalhes informados.'}"`
    });
    if (window.switchView) window.switchView('budgets');
  }
};
