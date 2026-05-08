/* ============================================================
   HIGHER CRM — ADMIN JS
   CRM + Kanban + Clients + Projects + Contacts
   ============================================================ */

'use strict';

/* ============================================================
   STATE
   ============================================================ */
const APP = {
  currentView: 'dashboard',
  db: null,
  session: null,
  data: {
    leads:    [],
    clients:  [],
    projects: [],
    tasks:    [],
    contacts: [],
    columns:  [],
  },
  kanban: {
    selectedProjectId: null,
  },
  editing: {
    clientId: null,
    projectId: null,
    taskId: null,
  }
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  APP.db = getSupabase();
  if (!APP.db) { console.error('[CRM] Supabase não disponível'); return; }

  // Check session
  const { data: { session } } = await APP.db.auth.getSession();
  if (session) {
    APP.session = session;
    showApp();
    await loadAll();
  } else {
    showLogin();
  }

  // Auth state listener
  APP.db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      APP.session = session;
      showApp();
      await loadAll();
    } else if (event === 'SIGNED_OUT') {
      APP.session = null;
      showLogin();
    }
  });

  setupUI();
  updateClock();
  setInterval(updateClock, 30000);
});

/* ============================================================
   AUTH
   ============================================================ */
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-app').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'flex';
  const user = APP.session?.user;
  if (user) {
    const email = user.email || '';
    document.getElementById('user-name').textContent = email.split('@')[0];
    document.getElementById('user-avatar').textContent = email.charAt(0).toUpperCase();
  }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login');
  const errEl = document.getElementById('login-error');

  btn.textContent = 'Entrando...';
  btn.disabled = true;
  errEl.style.display = 'none';

  const { error } = await APP.db.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent = 'E-mail ou senha inválidos.';
    errEl.style.display = 'block';
    btn.textContent = 'Entrar no Portal';
    btn.disabled = false;
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await APP.db.auth.signOut();
});

/* ============================================================
   SETUP UI
   ============================================================ */
function setupUI() {
  // Navigation
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Mobile menu
  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });

  // Close mobile menu when clicking outside
  document.getElementById('main-content').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-open');
  });

  // Refresh
  document.getElementById('btn-refresh').addEventListener('click', () => {
    loadAll();
    toast('Dados atualizados!', 'success');
  });

  // Kanban project select
  document.getElementById('kanban-project-select').addEventListener('change', (e) => {
    APP.kanban.selectedProjectId = e.target.value || null;
    document.getElementById('btn-new-task').disabled = !APP.kanban.selectedProjectId;
    if (APP.kanban.selectedProjectId) loadKanban(APP.kanban.selectedProjectId);
    else document.getElementById('kanban-board').innerHTML = '<div class="kanban-empty">👈 Selecione um projeto para ver o Kanban</div>';
  });

  // Client form
  document.getElementById('client-form').addEventListener('submit', handleSaveClient);

  // Project form
  document.getElementById('project-form').addEventListener('submit', handleSaveProject);

  // Task form
  document.getElementById('task-form').addEventListener('submit', handleSaveTask);

  // Search
  document.getElementById('leads-search').addEventListener('input', renderLeads);
  document.getElementById('leads-filter-plan').addEventListener('change', renderLeads);
  document.getElementById('leads-filter-status').addEventListener('change', renderLeads);
  document.getElementById('clients-search').addEventListener('input', renderClients);
  document.getElementById('projects-search').addEventListener('input', renderProjects);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

/* ============================================================
   VIEW SWITCHING
   ============================================================ */
function switchView(view) {
  APP.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.add('active');
  const navEl = document.getElementById(`nav-${view}`);
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    leads: '🎯 Leads',
    clients: '👥 Clientes',
    projects: '🚀 Projetos',
    kanban: '📋 Kanban',
    contacts: '✉️ Contatos',
    financial: '💰 Financeiro',
  };
  document.getElementById('view-title').textContent = titles[view] || view;

  // Load financial data on first visit
  if (view === 'financial') {
    populateFinClientFilter();
    loadFinancial();
  }

  document.getElementById('sidebar').classList.remove('mobile-open');
}

/* ============================================================
   LOAD ALL DATA
   ============================================================ */
async function loadAll() {
  await Promise.all([
    loadLeads(),
    loadClients(),
    loadProjects(),
    loadContacts(),
  ]);
  
  // Need to await others first so we can use APP.data to render Dashboard
  await loadDashboard();

  // Start Realtime only once
  if (!APP._realtimeStarted) {
    APP._realtimeStarted = true;
    startRealtime();
  }
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function loadDashboard() {
  // Stats
  const today = new Date().toISOString().split('T')[0];
  const leadsToday = APP.data.leads.filter(l => l.created_at.startsWith(today)).length;
  
  animCount('stat-val-leads', APP.data.leads.filter(l => l.status === 'new').length);
  animCount('stat-val-clients', APP.data.clients.length);
  animCount('stat-val-projects', APP.data.projects.filter(p => p.status === 'active').length);
  
  // Tasks count (need all tasks from all projects)
  // Let's fetch all active tasks across the board
  const { count: tasksCount } = await APP.db.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'doing');
  animCount('stat-val-tasks', tasksCount || 0);

  // Recent Leads List
  const recentLeads = APP.data.leads.slice(0, 5);
  const leadsList = document.getElementById('dash-leads-list');
  if (recentLeads.length === 0) {
    leadsList.innerHTML = '<div class="kanban-empty">Nenhum lead ainda.</div>';
  } else {
    leadsList.innerHTML = recentLeads.map(l => {
      const isNew = l.status === 'new';
      return `
        <div class="mini-item" style="cursor:pointer; ${isNew ? 'border-left: 3px solid var(--brand-orange)' : ''}" onclick="switchView('leads')">
          <div style="flex:1">
            <div style="font-weight:600;font-size:0.85rem">${escHtml(l.name)}</div>
            <div style="font-size:0.75rem;color:var(--text-3)">${escHtml(l.business_name || l.whatsapp)}</div>
          </div>
          <div style="font-size:0.7rem; color:var(--text-3)">
            ${isNew ? '<span style="color:var(--brand-orange);font-weight:700">NOVO</span>' : statusLabel(l.status)}
          </div>
        </div>
      `;
    }).join('');
  }

  // Recent Tasks List
  const { data: recentTasks } = await APP.db.from('tasks').select('*, projects(name)').order('created_at', { ascending: false }).limit(4);
  const tasksList = document.getElementById('dash-tasks-list');
  if (!recentTasks || recentTasks.length === 0) {
    tasksList.innerHTML = '<div class="kanban-empty">Nenhuma tarefa ainda.</div>';
  } else {
    tasksList.innerHTML = recentTasks.map(t => {
      return `
        <div class="mini-item" style="cursor:pointer" onclick="openKanbanForProject('${t.project_id}')">
          <div style="flex:1">
            <div style="font-weight:600;font-size:0.85rem">${escHtml(t.title)}</div>
            <div style="font-size:0.75rem;color:var(--text-3)">🚀 ${escHtml(t.projects?.name || 'Projeto Variante')}</div>
          </div>
          <div style="padding:0.2rem 0.5rem; border-radius:4px; font-size:0.7rem; background:rgba(255,255,255,.05)">
            ${escHtml(t.status || 'todo').toUpperCase()}
          </div>
        </div>
      `;
    }).join('');
  }
}

function animCount(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  const duration = 1000;
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

/* ============================================================
   REALTIME — Leads & Contacts do quiz chegam ao vivo
   ============================================================ */
function startRealtime() {
  // ── NEW LEAD from quiz ────────────────────────────────────
  APP.db
    .channel('public:leads')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'leads',
    }, (payload) => {
      const lead = payload.new;

      // Prepend to local state
      APP.data.leads.unshift(lead);

      // Update UI
      renderLeads();
      loadDashboard();

      // Update badge count
      const newCount = APP.data.leads.filter(l => l.status === 'new').length;
      const badge = document.getElementById('leads-badge');
      badge.textContent = newCount;
      badge.style.display = newCount > 0 ? 'inline-block' : 'none';

      // 🔔 Highlight notification
      toastLead(lead);

      // Flash sidebar leads nav
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
      renderContacts();
      toast(`✉️ Novo contato de ${payload.new.name}!`, 'info');
    })
    .subscribe();

  console.log('[CRM] 🔴 Realtime ativo — escutando leads e contatos em tempo real!');
}

/* Special toast for new leads */
function toastLead(lead) {
  const planColors = { starter: '#22C55E', growth: '#F59E0B', pro: '#FC5130' };
  const color = planColors[lead.recommended_plan] || '#FF6B1A';
  const el = document.createElement('div');
  el.style.cssText = `
    background: var(--bg-3);
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
  `;
  el.innerHTML = `
    <div style="font-weight:700;display:flex;align-items:center;gap:0.5rem">
      <span style="font-size:1.1rem">🎯</span>
      <span>Novo Lead do Quiz!</span>
    </div>
    <div style="color:var(--text-2);font-size:0.8rem">
      <strong>${escHtml(lead.name)}</strong> — ${planLabel(lead.recommended_plan)} · Score: ${lead.score}/100
    </div>
    <div style="color:var(--text-3);font-size:0.72rem">${escHtml(lead.business_name || lead.whatsapp)}</div>
    <div style="font-size:0.72rem;color:${color};margin-top:0.2rem">Clique para ver detalhes →</div>
  `;
  el.addEventListener('click', () => {
    switchView('leads');
    el.remove();
  });
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 350);
  }, 8000);
}

/* ============================================================
   LEADS
   ============================================================ */
async function loadLeads() {
  const { data, error } = await APP.db
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  APP.data.leads = data || [];
  renderLeads();

  const newCount = APP.data.leads.filter(l => l.status === 'new').length;
  const badge = document.getElementById('leads-badge');
  badge.textContent = newCount;
  badge.style.display = newCount > 0 ? 'inline-block' : 'none';
}

function renderLeads() {
  const search = document.getElementById('leads-search').value.toLowerCase();
  const planFilter = document.getElementById('leads-filter-plan').value;
  const statusFilter = document.getElementById('leads-filter-status').value;

  let leads = APP.data.leads.filter(l => {
    const matchSearch = !search || l.name?.toLowerCase().includes(search) || l.whatsapp?.includes(search) || l.business_name?.toLowerCase().includes(search);
    const matchPlan = !planFilter || l.recommended_plan === planFilter;
    const matchStatus = !statusFilter || l.status === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  const tbody = document.getElementById('leads-tbody');
  if (!leads.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Nenhum lead encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = leads.map(l => `
    <tr>
      <td class="td-name">${escHtml(l.name)}</td>
      <td><a href="https://wa.me/${l.whatsapp?.replace(/\D/g,'')}" target="_blank" style="color:#4ade80">${escHtml(l.whatsapp)}</a></td>
      <td>${escHtml(l.business_name || '—')}</td>
      <td><span class="badge badge-${l.recommended_plan}">${planLabel(l.recommended_plan)}</span></td>
      <td><span class="score-pill">${l.score}/100</span></td>
      <td><span class="badge badge-${l.status}">${statusLabel(l.status)}</span></td>
      <td style="color:var(--text-3)">${formatDate(l.created_at)}</td>
      <td>
        <div class="td-actions">
          <button class="btn-icon" title="Ver detalhes" onclick="openLeadDetail('${l.id}')">🔍</button>
          <a href="https://wa.me/${l.whatsapp?.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${l.name}! Sou da Agência Higher, vi que você fez nosso diagnóstico digital. Podemos conversar?`)}" target="_blank" class="btn-icon" title="WhatsApp" style="text-decoration:none;display:flex;align-items:center;justify-content:center;">💬</a>
          <button class="btn-icon" title="Converter em cliente" onclick="convertLeadToClient('${l.id}')">➕</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function openLeadDetail(id) {
  const lead = APP.data.leads.find(l => l.id === id);
  if (!lead) return;

  const answersHtml = lead.answers ? Object.entries(lead.answers).map(([qId, idxArr]) => {
    const q = QUESTION_MAP[qId];
    if (!q) return '';
    const answers = idxArr.map(i => `${q.options[i]?.emoji || ''} ${q.options[i]?.label || ''}`).join(', ');
    return `
      <div class="lead-answer-item">
        <div class="lead-answer-q">${q.category} — ${q.text}</div>
        <div class="lead-answer-a">${answers}</div>
      </div>
    `;
  }).join('') : '';

  document.getElementById('modal-lead-body').innerHTML = `
    <div class="lead-detail-grid">
      <div class="lead-detail-field"><span class="lead-detail-label">Nome</span><span class="lead-detail-value">${escHtml(lead.name)}</span></div>
      <div class="lead-detail-field"><span class="lead-detail-label">WhatsApp</span><span class="lead-detail-value">${escHtml(lead.whatsapp)}</span></div>
      <div class="lead-detail-field"><span class="lead-detail-label">Empresa</span><span class="lead-detail-value">${escHtml(lead.business_name || '—')}</span></div>
      <div class="lead-detail-field"><span class="lead-detail-label">Score</span><span class="lead-detail-value">${lead.score}/100</span></div>
      <div class="lead-detail-field"><span class="lead-detail-label">Plano Recomendado</span><span class="lead-detail-value"><span class="badge badge-${lead.recommended_plan}">${planLabel(lead.recommended_plan)}</span></span></div>
      <div class="lead-detail-field"><span class="lead-detail-label">Data</span><span class="lead-detail-value">${formatDate(lead.created_at)}</span></div>
      ${lead.utm_source ? `<div class="lead-detail-field"><span class="lead-detail-label">Origem</span><span class="lead-detail-value">${escHtml(lead.utm_source)}</span></div>` : ''}
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
  openModal('modal-lead');
}

async function updateLeadStatusLocal(id, status) {
  const { error } = await APP.db.from('leads').update({ status }).eq('id', id);
  if (error) { toast('Erro ao atualizar status', 'error'); return; }
  const lead = APP.data.leads.find(l => l.id === id);
  if (lead) lead.status = status;
  renderLeads();
  toast('Status atualizado!', 'success');
}

function convertLeadToClient(leadId) {
  const lead = APP.data.leads.find(l => l.id === leadId);
  if (!lead) return;
  openClientModal({
    name: lead.name,
    whatsapp: lead.whatsapp,
    plan: lead.recommended_plan,
    lead_id: leadId,
  });
}

/* ============================================================
   CLIENTS
   ============================================================ */
async function loadClients() {
  const { data, error } = await APP.db
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  APP.data.clients = data || [];
  renderClients();
  populateClientSelect();
}

function renderClients() {
  const search = document.getElementById('clients-search').value.toLowerCase();
  const clients = APP.data.clients.filter(c =>
    !search || c.name?.toLowerCase().includes(search) || c.company?.toLowerCase().includes(search)
  );

  const grid = document.getElementById('clients-grid');
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
            <div class="client-name">${escHtml(c.name)}</div>
            <div class="client-company">${escHtml(c.company || 'Sem empresa')}</div>
          </div>
        </div>
        <div class="client-card-meta">
          <span class="badge badge-${c.status}">${statusLabel(c.status)}</span>
          ${c.plan ? `<span class="badge badge-${c.plan}">${planLabel(c.plan)}</span>` : ''}
        </div>
        <div class="client-card-actions">
          <button class="btn-icon" title="WhatsApp" onclick="window.open('https://wa.me/${(c.whatsapp||'').replace(/\D/g,'')}','_blank')">💬</button>
          <button class="btn-icon" title="Editar" onclick="openClientModal(null, '${c.id}')">✏️</button>
          <button class="btn-icon" title="Ver projetos" onclick="filterProjectsByClient('${c.id}')">📋</button>
          <button class="btn-icon" title="Novo projeto" onclick="openProjectModal('${c.id}')">🚀</button>
        </div>
        <div class="client-projects">${projectCount} projeto${projectCount !== 1 ? 's' : ''}</div>
      </div>
    `;
  }).join('');
}

function openClientModal(prefill = null, editId = null) {
  APP.editing.clientId = editId;
  const form = document.getElementById('client-form');
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
    document.getElementById('cf-notes').value = c.notes || '';
  } else if (prefill) {
    document.getElementById('client-modal-title').textContent = '👤 Novo Cliente';
    document.getElementById('cf-name').value = prefill.name || '';
    document.getElementById('cf-whatsapp').value = prefill.whatsapp || '';
    document.getElementById('cf-plan').value = prefill.plan || '';
  } else {
    document.getElementById('client-modal-title').textContent = '👤 Novo Cliente';
  }
  openModal('modal-client');
}

async function handleSaveClient(e) {
  e.preventDefault();
  const id = document.getElementById('client-id').value;
  const payload = {
    name:    document.getElementById('cf-name').value.trim(),
    company: document.getElementById('cf-company').value.trim() || null,
    email:   document.getElementById('cf-email').value.trim() || null,
    whatsapp: document.getElementById('cf-whatsapp').value.trim() || null,
    document: document.getElementById('cf-document') ? (document.getElementById('cf-document').value.replace(/\D/g, '') || null) : null,
    postal_code: document.getElementById('cf-postalcode') ? (document.getElementById('cf-postalcode').value.replace(/\D/g, '') || null) : null,
    address_number: document.getElementById('cf-number') ? (document.getElementById('cf-number').value.trim() || null) : null,
    plan:    document.getElementById('cf-plan').value || null,
    status:  document.getElementById('cf-status').value,
    notes:   document.getElementById('cf-notes').value.trim() || null,
    avatar_color: randomColor(),
  };

  if (!payload.name) { toast('Nome é obrigatório', 'error'); return; }

  const btn = document.getElementById('btn-save-client');
  if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

  try {
    let errorObj;
    // Usamos UPSERT (Método POST) em vez de UPDATE (Método PATCH) para driblar o bloqueio de rede/antivírus
    if (id) {
      const { error } = await APP.db.from('clients').upsert({ id, ...payload });
      errorObj = error;
    } else {
      const { error } = await APP.db.from('clients').insert([payload]);
      errorObj = error;
    }

    if (errorObj) throw errorObj;
    
    toast(id ? 'Cliente atualizado!' : 'Cliente criado!', 'success');
    closeModal('modal-client');
    await loadClients();
  } catch (err) {
    console.error("Save Client Error:", err);
    toast('Erro ao salvar cliente: ' + (err.message || 'Desconhecido'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Cliente'; }
  }
}

function filterProjectsByClient(clientId) {
  switchView('projects');
  const client = APP.data.clients.find(c => c.id === clientId);
  if (client) document.getElementById('projects-search').value = client.name;
  renderProjects();
}

/* ============================================================
   PROJECTS
   ============================================================ */
async function loadProjects() {
  const { data, error } = await APP.db
    .from('projects')
    .select('*, clients(name, company)')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  APP.data.projects = data || [];
  renderProjects();
  populateKanbanProjectSelect();
}

function renderProjects() {
  const search = document.getElementById('projects-search').value.toLowerCase();
  const projects = APP.data.projects.filter(p => {
    const clientName = p.clients?.name || '';
    return !search || p.name?.toLowerCase().includes(search) || clientName.toLowerCase().includes(search);
  });

  const list = document.getElementById('projects-list');
  if (!projects.length) {
    list.innerHTML = '<div class="mini-list-loading">Nenhum projeto encontrado.</div>';
    return;
  }

  list.innerHTML = projects.map(p => `
    <div class="project-item" onclick="openKanbanForProject('${p.id}')">
      <div class="project-color-bar" style="background:${p.color || '#FF6B1A'}"></div>
      <div class="project-info">
        <div class="project-name">${escHtml(p.name)}</div>
        <div class="project-client">👤 ${escHtml(p.clients?.name || 'Cliente não encontrado')}</div>
      </div>
      <div class="project-meta">
        ${p.plan ? `<span class="badge badge-${p.plan}">${planLabel(p.plan)}</span>` : ''}
        <span class="badge badge-${p.status}">${statusLabel(p.status)}</span>
        <div class="project-progress-wrap">
          <div class="project-progress-bar"><div class="project-progress-fill" style="width:${p.progress || 0}%"></div></div>
          <span class="project-progress-pct">${p.progress || 0}%</span>
        </div>
        ${p.deadline ? `<span class="project-deadline">📅 ${formatDate(p.deadline, true)}</span>` : ''}
      </div>
      <div class="td-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" title="Editar" onclick="openProjectModal(null,'${p.id}')">✏️</button>
        <button class="btn-icon" title="Ver Kanban" onclick="openKanbanForProject('${p.id}')">📋</button>
      </div>
    </div>
  `).join('');
}

function openProjectModal(clientId = null, editId = null) {
  APP.editing.projectId = editId;
  const form = document.getElementById('project-form');
  form.reset();
  populateClientSelect();

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
    document.getElementById('pf-description').value = p.description || '';
  } else {
    document.getElementById('project-modal-title').textContent = '🚀 Novo Projeto';
    if (clientId) document.getElementById('pf-client').value = clientId;
  }
  openModal('modal-project');
}

async function handleSaveProject(e) {
  e.preventDefault();
  const id = document.getElementById('project-id').value;
  const payload = {
    name:        document.getElementById('pf-name').value.trim(),
    client_id:   document.getElementById('pf-client').value,
    plan:        document.getElementById('pf-plan').value || null,
    deadline:    document.getElementById('pf-deadline').value || null,
    status:      document.getElementById('pf-status').value,
    progress:    parseInt(document.getElementById('pf-progress').value) || 0,
    description: document.getElementById('pf-description').value.trim() || null,
    color:       randomColor(),
  };

  if (!payload.name || !payload.client_id) { toast('Nome e cliente são obrigatórios', 'error'); return; }

  const btn = document.getElementById('btn-save-project');
  btn.disabled = true; btn.textContent = 'Salvando...';

  let data, error;
  if (id) {
    ({ error } = await APP.db.from('projects').update(payload).eq('id', id));
  } else {
    ({ data, error } = await APP.db.from('projects').insert([payload]).select().single());
    // create default kanban columns
    if (!error && data) {
      await APP.db.rpc('create_default_columns', { p_project_id: data.id });
    }
  }

  btn.disabled = false; btn.textContent = 'Salvar Projeto';
  if (error) { toast('Erro ao salvar projeto: ' + error.message, 'error'); return; }
  toast(id ? 'Projeto atualizado!' : 'Projeto criado com colunas Kanban!', 'success');
  closeModal('modal-project');
  await loadProjects();
}

function populateClientSelect() {
  const sel = document.getElementById('pf-client');
  const current = sel.value;
  sel.innerHTML = '<option value="">Selecione o cliente...</option>' +
    APP.data.clients.map(c => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${escHtml(c.name)}${c.company ? ` — ${escHtml(c.company)}` : ''}</option>`).join('');
}

/* ============================================================
   KANBAN
   ============================================================ */
function populateKanbanProjectSelect() {
  const sel = document.getElementById('kanban-project-select');
  const current = sel.value;
  sel.innerHTML = '<option value="">Selecione um projeto...</option>' +
    APP.data.projects.map(p => {
      const client = APP.data.clients.find(c => c.id === p.client_id);
      return `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${escHtml(p.name)}${client ? ` — ${escHtml(client.name)}` : ''}</option>`;
    }).join('');
}

function openKanbanForProject(projectId) {
  switchView('kanban');
  document.getElementById('kanban-project-select').value = projectId;
  APP.kanban.selectedProjectId = projectId;
  document.getElementById('btn-new-task').disabled = false;
  loadKanban(projectId);
}

async function loadKanban(projectId) {
  const board = document.getElementById('kanban-board');
  board.innerHTML = '<div class="kanban-empty">Carregando...</div>';

  const [colRes, taskRes] = await Promise.all([
    APP.db.from('kanban_columns').select('*').eq('project_id', projectId).order('position'),
    APP.db.from('tasks').select('*').eq('project_id', projectId).order('position'),
  ]);

  if (colRes.error) { board.innerHTML = '<div class="kanban-empty">Erro ao carregar colunas.</div>'; return; }

  const columns = colRes.data || [];
  const tasks = taskRes.data || [];
  APP.data.columns = columns;
  APP.data.tasks = tasks;

  if (!columns.length) {
    board.innerHTML = '<div class="kanban-empty">Nenhuma coluna encontrada. Recrie o projeto para gerar as colunas padrão.</div>';
    return;
  }

  board.innerHTML = columns.map(col => {
    const colTasks = tasks.filter(t => t.column_id === col.id);
    return `
      <div class="kanban-col" id="col-${col.id}">
        <div class="kanban-col-header">
          <div class="kanban-col-name">
            <span>${col.icon || '📋'}</span>
            <span>${escHtml(col.name)}</span>
            <span class="kanban-col-count">${colTasks.length}</span>
          </div>
          <button class="kanban-col-add" title="Adicionar tarefa" onclick="openTaskModal('${col.id}')">+</button>
        </div>
        <div class="kanban-cards" id="cards-${col.id}">
          ${colTasks.length ? colTasks.map(task => renderTaskCard(task)).join('') : '<div class="kanban-empty-col">Nenhuma tarefa</div>'}
        </div>
      </div>
    `;
  }).join('');
}

function renderTaskCard(task) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  return `
    <div class="kanban-card" onclick="openTaskModal(null, '${task.id}')">
      <div class="kanban-card-priority ${task.priority}"></div>
      <div class="kanban-card-title">${escHtml(task.title)}</div>
      <div class="kanban-card-meta">
        <span class="kanban-card-due ${isOverdue ? 'overdue' : ''}">${task.due_date ? '📅 ' + formatDate(task.due_date, true) : ''}</span>
        <div class="kanban-card-tags">${(task.tags || []).map(t => `<span class="kanban-tag">${escHtml(t)}</span>`).join('')}</div>
      </div>
    </div>
  `;
}

function openTaskModal(columnId = null, editId = null) {
  APP.editing.taskId = editId;
  const form = document.getElementById('task-form');
  form.reset();

  // Populate columns select
  const colSel = document.getElementById('tf-column');
  colSel.innerHTML = APP.data.columns.map(c =>
    `<option value="${c.id}" ${c.id === columnId ? 'selected' : ''}>${c.icon} ${escHtml(c.name)}</option>`
  ).join('');

  document.getElementById('task-project-id').value = APP.kanban.selectedProjectId || '';

  if (editId) {
    const task = APP.data.tasks.find(t => t.id === editId);
    if (!task) return;
    document.getElementById('task-modal-title').textContent = '✏️ Editar Tarefa';
    document.getElementById('task-id').value = task.id;
    document.getElementById('tf-title').value = task.title || '';
    document.getElementById('tf-column').value = task.column_id || '';
    document.getElementById('tf-priority').value = task.priority || 'medium';
    document.getElementById('tf-due').value = task.due_date || '';
    document.getElementById('tf-visible').value = task.is_visible_to_client ? 'true' : 'false';
    document.getElementById('tf-description').value = task.description || '';
  } else {
    document.getElementById('task-modal-title').textContent = '📋 Nova Tarefa';
    if (columnId) document.getElementById('tf-column').value = columnId;
  }
  openModal('modal-task');
}

async function handleSaveTask(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const projectId = document.getElementById('task-project-id').value;
  const payload = {
    project_id: projectId,
    column_id:  document.getElementById('tf-column').value,
    title:      document.getElementById('tf-title').value.trim(),
    priority:   document.getElementById('tf-priority').value,
    due_date:   document.getElementById('tf-due').value || null,
    description: document.getElementById('tf-description').value.trim() || null,
    is_visible_to_client: document.getElementById('tf-visible').value === 'true',
    position:   APP.data.tasks.length,
  };

  if (!payload.title || !payload.column_id || !payload.project_id) {
    toast('Título, coluna e projeto são obrigatórios', 'error'); return;
  }

  let error;
  if (id) {
    ({ error } = await APP.db.from('tasks').update(payload).eq('id', id));
  } else {
    ({ error } = await APP.db.from('tasks').insert([payload]));
  }

  if (error) { toast('Erro ao salvar tarefa: ' + error.message, 'error'); return; }
  toast(id ? 'Tarefa atualizada!' : 'Tarefa criada!', 'success');
  closeModal('modal-task');
  await loadKanban(projectId);
}

/* ============================================================
   CONTACTS
   ============================================================ */
async function loadContacts() {
  const { data, error } = await APP.db
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  APP.data.contacts = data || [];
  renderContacts();
}

function renderContacts() {
  const tbody = document.getElementById('contacts-tbody');
  const contacts = APP.data.contacts;
  if (!contacts.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Nenhum contato recebido ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = contacts.map(c => `
    <tr>
      <td class="td-name">${escHtml(c.name)}</td>
      <td><a href="mailto:${c.email}" style="color:#60a5fa">${escHtml(c.email)}</a></td>
      <td>${escHtml(c.phone || '—')}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(c.message)}">${escHtml(c.message)}</td>
      <td><span class="badge badge-${c.status === 'new' ? 'new' : c.status === 'replied' ? 'contacted' : 'closed'}">${c.status === 'new' ? '🟢 Novo' : c.status === 'replied' ? '✅ Respondido' : '🔒 Encerrado'}</span></td>
      <td style="color:var(--text-3)">${formatDate(c.created_at)}</td>
      <td>
        <div class="td-actions">
          <a href="mailto:${c.email}" class="btn-icon" title="Responder e-mail" style="text-decoration:none;display:flex;align-items:center;justify-content:center">✉️</a>
          <button class="btn-icon" title="Marcar como respondido" onclick="updateContactStatus('${c.id}','replied')">✅</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function updateContactStatus(id, status) {
  const { error } = await APP.db.from('contacts').update({ status }).eq('id', id);
  if (error) { toast('Erro ao atualizar', 'error'); return; }
  await loadContacts();
  toast('Contato atualizado!', 'success');
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function loadDashboard() {
  // Stats
  const newLeads = APP.data.leads.filter(l => l.status === 'new').length;
  const activeClients = APP.data.clients.filter(c => c.status === 'active').length;
  const activeProjects = APP.data.projects.filter(p => p.status === 'active').length;

  animCount('stat-val-leads', newLeads);
  animCount('stat-val-clients', activeClients);
  animCount('stat-val-projects', activeProjects);
  animCount('stat-val-tasks', APP.data.tasks.filter(t => {
    const col = APP.data.columns.find(c => c.id === t.column_id);
    return col?.name === 'Em Andamento';
  }).length);

  // Recent leads
  const recentLeads = APP.data.leads.slice(0, 6);
  document.getElementById('dash-leads-list').innerHTML = recentLeads.length
    ? recentLeads.map(l => `
      <div class="mini-item" onclick="openLeadDetail('${l.id}')">
        <span class="mini-item-icon">${planEmoji(l.recommended_plan)}</span>
        <div class="mini-item-info">
          <div class="mini-item-name">${escHtml(l.name)}</div>
          <div class="mini-item-sub">${escHtml(l.business_name || l.whatsapp)} · ${formatDate(l.created_at)}</div>
        </div>
        <div class="mini-item-badge"><span class="badge badge-${l.status}">${statusLabel(l.status)}</span></div>
      </div>
    `).join('')
    : '<div class="mini-list-loading">Nenhum lead ainda.</div>';

  // Recent tasks
  const recentTasks = APP.data.tasks.slice(0, 6);
  document.getElementById('dash-tasks-list').innerHTML = recentTasks.length
    ? recentTasks.map(t => `
      <div class="mini-item">
        <span class="mini-item-icon priority-${t.priority}">⚡</span>
        <div class="mini-item-info">
          <div class="mini-item-name">${escHtml(t.title)}</div>
          <div class="mini-item-sub">${t.due_date ? '📅 ' + formatDate(t.due_date, true) : 'Sem prazo'}</div>
        </div>
      </div>
    `).join('')
    : '<div class="mini-list-loading">Nenhuma tarefa ainda.</div>';
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

/* ============================================================
   TOAST
   ============================================================ */
function toast(message, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${escHtml(message)}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/* ============================================================
   HELPERS
   ============================================================ */
function formatDate(d, short = false) {
  if (!d) return '—';
  const date = new Date(d);
  if (short) return date.toLocaleDateString('pt-BR');
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function planLabel(p) {
  return { starter: '🪤 Starter', growth: '💎 Growth', pro: '🚀 Pro' }[p] || p || '—';
}

function planEmoji(p) {
  return { starter: '🪤', growth: '💎', pro: '🚀' }[p] || '🎯';
}

function statusLabel(s) {
  return { new: '🟢 Novo', contacted: '📞 Contatado', qualified: '⭐ Qualificado',
           closed: '✅ Fechado', lost: '❌ Perdido', active: '✅ Ativo',
           paused: '⏸️ Pausado', churned: '❌ Encerrado', prospect: '🔍 Prospect',
           completed: '🏆 Concluído', cancelled: '❌ Cancelado' }[s] || s || '—';
}

function randomColor() {
  const colors = ['#7C3AED','#FF6B1A','#22C55E','#F59E0B','#C026D3','#0EA5E9','#EF4444','#10B981'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function animCount(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  let cur = 0;
  const step = Math.max(1, Math.round(target / 30));
  const timer = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(timer);
  }, 40);
}

function updateClock() {
  const el = document.getElementById('topbar-time');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Question map for lead detail (labels from quiz.js)
const QUESTION_MAP = {
  'q-stage':    { category: 'Estágio', text: 'Estágio atual online?', options: [
    { emoji: '🌱', label: 'Ainda não estou online' }, { emoji: '📱', label: 'Só Instagram/WhatsApp' },
    { emoji: '🌐', label: 'Tenho um site básico' }, { emoji: '🚀', label: 'Tenho site + quero evoluir' }
  ]},
  'q-goal':     { category: 'Objetivo', text: 'Principal meta em 6 meses?', options: [
    { emoji: '👋', label: 'Aparecer no Google' }, { emoji: '💬', label: 'Mais contatos WhatsApp' },
    { emoji: '📈', label: 'Aumentar vendas' }, { emoji: '🤖', label: 'Automatizar e escalar' }
  ]},
  'q-segment':  { category: 'Segmento', text: 'Segmento de atuação?', options: [
    { emoji: '🍽️', label: 'Restaurante/Alimentação' }, { emoji: '💇', label: 'Beleza/Estética' },
    { emoji: '🏥', label: 'Saúde/Clínica' }, { emoji: '🛍️', label: 'E-commerce' },
    { emoji: '📚', label: 'Educação/Cursos' }, { emoji: '🏢', label: 'B2B/Empresa' },
    { emoji: '⛪', label: 'Igreja/ONG' }, { emoji: '🔧', label: 'Outro' }
  ]},
  'q-pain':     { category: 'Dor principal', text: 'Maior dor atual?', options: [
    { emoji: '🙈', label: 'Sem presença digital' }, { emoji: '⏰', label: 'Demora responder' },
    { emoji: '📉', label: 'Poucos leads qualificados' }, { emoji: '🤯', label: 'Operação caótica' }
  ]},
  'q-features': { category: 'Funcionalidades', text: 'Recursos necessários?', options: [
    { emoji: '🌐', label: 'Site profissional' }, { emoji: '💬', label: 'Integração WhatsApp' },
    { emoji: '📅', label: 'Agendamento/pedidos' }, { emoji: '🤖', label: 'Chatbot' },
    { emoji: '📊', label: 'Painel/CRM' }, { emoji: '🧠', label: 'Inteligência Artificial' }
  ]},
  'q-urgency':  { category: 'Urgência', text: 'Prazo e investimento?', options: [
    { emoji: '🐢', label: 'Sem pressa, essencial' }, { emoji: '📆', label: '1–3 meses, moderado' },
    { emoji: '🔥', label: 'Urgente, resultados rápidos' }, { emoji: '🏆', label: 'Melhor — dominar mercado' }
  ]},
};
