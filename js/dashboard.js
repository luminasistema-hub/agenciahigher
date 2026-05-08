/**
 * HIGHER CRM — DASHBOARD MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';

export const DASHBOARD = {
  charts: {},

  async load() {
    // 1. Calculate General Stats
    const activeProjects = APP.data.projects.filter(p => p.status === 'active').length;
    const recentLeads = APP.data.leads.filter(l => {
      const created = new Date(l.created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return created >= sevenDaysAgo;
    }).length;

    // 2. Calculate MRR (Monthly Recurring Revenue)
    // Assuming invoices table has 'total' and 'is_recurring'
    let mrrTotal = 0;
    try {
      const { data: recurringInvoices } = await APP.db
        .from('invoices')
        .select('total')
        .eq('is_recurring', true)
        .neq('status', 'cancelled');
      
      mrrTotal = (recurringInvoices || []).reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    } catch (e) { console.warn('[Dash] MRR calculation error', e); }

    // 3. Conversion Rate
    const closedLeads = APP.data.leads.filter(l => l.status === 'won').length;
    const totalLeads = APP.data.leads.length;
    const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

    // 4. Update UI Values
    UTILS.animCountCurrency('stat-mrr', mrrTotal);
    UTILS.animCount('stat-projects', activeProjects);
    UTILS.animCount('stat-leads', recentLeads);
    UTILS.animCount('stat-conversion', conversionRate, '%');

    // 5. Render Lists
    this.renderRecentLeads();
    this.renderRecentTasks();

    // 6. Initialize Charts with small delay
    setTimeout(() => this.initCharts(), 100);
    // 3. Feedbacks Recentes
    this.renderFeedbacks();
  },

  async renderFeedbacks() {
    const listEl = document.getElementById('dash-feedback-list');
    if (!listEl) return;

    const { data, error } = await APP.db
      .from('deliverables')
      .select('*, projects(name)')
      .not('client_feedback', 'is', null)
      .order('last_feedback_at', { ascending: false })
      .limit(5);

    if (error || !data || data.length === 0) {
      listEl.innerHTML = '<div class="mini-list-empty">Nenhum feedback recente.</div>';
      return;
    }

    listEl.innerHTML = data.map(d => `
      <div class="mini-list-item" onclick="openDeliveryModal('${d.project_id}')" style="cursor:pointer">
        <div class="item-info">
          <div class="item-title">${UTILS.escHtml(d.name)} <span style="font-size:0.7rem; color:var(--brand-orange)">— ${UTILS.escHtml(d.projects?.name)}</span></div>
          <div class="item-sub" style="font-style: italic; color: #eee;">"${d.client_feedback.substring(0, 50)}${d.client_feedback.length > 50 ? '...' : ''}"</div>
        </div>
        <div class="item-meta">
          <span class="badge badge-in_review">AJUSTE</span>
        </div>
      </div>
    `).join('');
  },

  renderRecentLeads() {
    const listEl = document.getElementById('dash-leads-list');
    if (!listEl) return;
    const recent = APP.data.leads.slice(0, 5);
    listEl.innerHTML = recent.length ? recent.map(l => `
      <div class="mini-item" onclick="switchView('leads')">
        <div style="flex:1">
          <div style="font-weight:600;font-size:0.85rem">${UTILS.escHtml(l.name)}</div>
          <div style="font-size:0.75rem;color:var(--text-3)">${UTILS.escHtml(l.business_name || 'Individual')}</div>
        </div>
        <span class="badge badge-${l.status}">${UTILS.statusLabel(l.status)}</span>
      </div>
    `).join('') : '<div class="kanban-empty">Sem leads recentes.</div>';
  },

  async renderRecentTasks() {
    const listEl = document.getElementById('dash-tasks-list');
    if (!listEl) return;
    try {
      const { data } = await APP.db.from('tasks').select('*, projects(name)').order('created_at', { ascending: false }).limit(5);
      listEl.innerHTML = (data || []).map(t => `
        <div class="mini-item" onclick="openKanbanForProject('${t.project_id}')">
          <div style="flex:1">
            <div style="font-weight:600;font-size:0.85rem">${UTILS.escHtml(t.title)}</div>
            <div style="font-size:0.75rem;color:var(--text-3)">🚀 ${UTILS.escHtml(t.projects?.name || 'Projeto')}</div>
          </div>
          <div style="font-size:0.7rem; opacity:0.6">${t.status.toUpperCase()}</div>
        </div>
      `).join('');
    } catch (e) { listEl.innerHTML = '<div class="kanban-empty">Erro ao carregar tarefas.</div>'; }
  },

  initCharts() {
    if (!window.Chart) return;

    // Destroy existing charts if any (to prevent overlap on reload)
    Object.values(this.charts).forEach(c => c.destroy());

    // Chart 1: Revenue (MRR) - Growth Line
    const ctxRevenue = document.getElementById('chart-revenue')?.getContext('2d');
    if (ctxRevenue) {
      this.charts.revenue = new Chart(ctxRevenue, {
        type: 'line',
        data: {
          labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
          datasets: [{
            label: 'MRR Growth',
            data: [12000, 15000, 14200, 19000, 22000, 26000], // Simulated growth
            borderColor: '#FF6B1A',
            backgroundColor: 'rgba(255, 107, 26, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#FF6B1A'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999' } },
            x: { grid: { display: false }, ticks: { color: '#999' } }
          }
        }
      });
    }

    // Chart 2: Sales Funnel - Bar
    const ctxFunnel = document.getElementById('chart-funnel')?.getContext('2d');
    if (ctxFunnel) {
      const statusCounts = {
        new: APP.data.leads.filter(l => l.status === 'new').length,
        contacted: APP.data.leads.filter(l => l.status === 'contacted').length,
        negotiation: APP.data.leads.filter(l => l.status === 'negotiation').length,
        won: APP.data.leads.filter(l => l.status === 'won').length
      };

      this.charts.funnel = new Chart(ctxFunnel, {
        type: 'bar',
        data: {
          labels: ['Novos', 'Contato', 'Negociação', 'Fechados'],
          datasets: [{
            data: [statusCounts.new, statusCounts.contacted, statusCounts.negotiation, statusCounts.won],
            backgroundColor: ['#2979ff', '#651fff', '#FF6B1A', '#00c853'],
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999', font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { color: '#999', font: { size: 11 } } }
          }
        }
      });
    }
  }
};
