/**
 * CLIENT PORTAL LOGIC
 * Authentication via Document (CPF/CNPJ)
 * Tracking Projects, Tasks and Invoices
 */

const PORTAL = {
  client: null,
  projects: [],
  tasks: [],
  invoices: [],
  notifications: [],
};

// 1. LOGIN
const loginForm = document.getElementById('portal-login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const doc = document.getElementById('login-doc').value.replace(/\D/g, '');
    const errorEl = document.getElementById('login-error');
    
    if (errorEl) errorEl.style.display = 'none';

    try {
      // Find client by document (strip formatting)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or(`document.eq.${doc},document.ilike.%${doc}%`)
        .limit(1)
        .single();

      if (error || !data) {
        if (errorEl) errorEl.style.display = 'block';
        return;
      }

      PORTAL.client = data;
      localStorage.setItem('higher_client_portal', JSON.stringify(data));
      showPortal();
    } catch (err) {
      console.error(err);
      if (errorEl) errorEl.style.display = 'block';
    }
  });
}

async function showPortal() {
  document.getElementById('portal-login').style.display = 'none';
  document.getElementById('portal-app').style.display = 'flex';
  document.getElementById('client-name-display').textContent = `Olá, ${PORTAL.client.name.split(' ')[0]}`;
  
  showPortalSkeletons();
  await loadPortalData();
  await loadNotifications();
  renderPortalProjects();
  renderPortalInvoices();
  renderPortalProfile();
  setupPortalRealtime();
}

async function loadNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('client_id', PORTAL.client.id)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (data) {
    PORTAL.notifications = data;
    renderNotifications();
  }
}

function renderNotifications() {
  const unread = PORTAL.notifications?.filter(n => !n.is_read).length || 0;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'inline-block' : 'none';
  }

  const list = document.getElementById('notif-list');
  if (!list) return;

  if (!PORTAL.notifications?.length) {
    list.innerHTML = '<div class="mini-item">Nenhuma notificação.</div>';
    return;
  }

  list.innerHTML = PORTAL.notifications.map(n => `
    <div class="mini-item" style="${!n.is_read ? 'border-left: 3px solid var(--brand-orange)' : ''}" onclick="markNotifRead('${n.id}')">
      <div style="font-weight:600; font-size:0.85rem">${escHtml(n.title)}</div>
      <div style="font-size:0.75rem; color:#8E8D8C">${escHtml(n.message)}</div>
      <div style="font-size:0.65rem; color:#666; margin-top:0.3rem">${new Date(n.created_at).toLocaleString('pt-BR')}</div>
    </div>
  `).join('');
}

function toggleNotifications() {
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

async function markNotifRead(id) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  const n = PORTAL.notifications.find(notif => notif.id === id);
  if (n) n.is_read = true;
  renderNotifications();
}

function showPortalSkeletons() {
  const projContainer = document.getElementById('projects-list-portal');
  if (projContainer) projContainer.innerHTML = Array(2).fill(0).map(() => `<div class="skeleton skeleton-card" style="height:250px"></div>`).join('');
  
  const invContainer = document.getElementById('invoice-list-portal');
  if (invContainer) invContainer.innerHTML = Array(3).fill(0).map(() => `<div class="skeleton skeleton-row"></div>`).join('');
}

async function loadPortalData() {
  // 1. Projects
  const { data: projs } = await supabase
    .from('projects')
    .select('*')
    .eq('client_id', PORTAL.client.id)
    .order('created_at', { ascending: false });
  PORTAL.projects = projs || [];

  // 2. Tasks for these projects
  const projIds = PORTAL.projects.map(p => p.id);
  if (projIds.length > 0) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .in('project_id', projIds)
      .order('created_at', { ascending: false });
    PORTAL.tasks = tasks || [];
  }

  // 3. Invoices
  const { data: invs } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', PORTAL.client.id)
    .order('due_date', { ascending: false });
  PORTAL.invoices = invs || [];
}

function renderPortalProjects() {
  const container = document.getElementById('projects-list-portal');
  if (PORTAL.projects.length === 0) {
    container.innerHTML = `
      <div class="client-card" style="text-align:center">
        <h3>Nenhum projeto ativo</h3>
        <p style="color:#8E8D8C">Fale com seu consultor para iniciar um novo projeto.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = PORTAL.projects.map(p => {
    const pTasks = PORTAL.tasks.filter(t => t.project_id === p.id);
    const recentTasks = pTasks.slice(0, 5); // Show top 5
    const progress = p.progress || 0;

    return `
      <div class="client-card">
        <div class="project-header">
          <div class="project-title">
            <h3>${escHtml(p.name)}</h3>
            <span class="badge" style="background:rgba(252,81,48,0.1); color:var(--brand-orange); margin-top:0.5rem; display:inline-block">
              ${p.status === 'active' ? '🟢 Em Andamento' : '✅ Concluído'}
            </span>
          </div>
          <div style="text-align:right">
            <span style="font-size: 1.2rem; font-weight: 800; font-family:'Outfit'">${progress}%</span>
          </div>
        </div>

        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>

        <div style="margin-top: 2rem;">
          <h4 style="margin-bottom: 1rem; color: #8E8D8C; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Entregas & Tarefas Recentes</h4>
          <div class="task-list-portal">
            ${recentTasks.map(t => `
              <div class="task-item-portal">
                <div class="task-status-dot ${getTaskStatusClass(t.column_id)}"></div>
                <div style="flex:1">
                  <div style="font-weight: 500">${escHtml(t.title)}</div>
                  <div style="font-size: 0.75rem; color: #666">${t.description || 'Tarefa em andamento'}</div>
                </div>
                <div style="font-size: 0.8rem; color: #8E8D8C">
                  ${t.column_id === 'done' ? '✅ Entregue' : '⏳ Em fila'}
                </div>
              </div>
            `).join('') || '<p style="color:#666; font-size:0.85rem">Nenhuma tarefa registrada ainda.</p>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPortalInvoices() {
  const container = document.getElementById('invoice-list-portal');
  if (PORTAL.invoices.length === 0) {
    container.innerHTML = '<p style="color:#8E8D8C; text-align:center; padding:2rem;">Nenhuma fatura encontrada.</p>';
    return;
  }

  container.innerHTML = PORTAL.invoices.map(inv => {
    const status = inv.status || 'draft';
    const statusLabel = { paid: 'Pago', overdue: 'Atrasado', sent: 'Pendente', draft: 'Rascunho' }[status];
    const statusClass = `status-${status}`;

    return `
      <div class="invoice-item">
        <div class="invoice-info">
          <h4>${inv.invoice_number || 'Fatura #'}</h4>
          <p>Vencimento: ${new Date(inv.due_date).toLocaleDateString('pt-BR')}</p>
        </div>
        <div style="text-align: right">
          <div style="font-family:'Outfit'; font-weight:700; margin-bottom:0.5rem">
            R$ ${Number(inv.total).toLocaleString('pt-BR', {minimumFractionDigits:2})}
          </div>
          <span class="invoice-status ${statusClass}">${statusLabel}</span>
          ${(status === 'sent' || status === 'overdue') && inv.asaas_payment_url ? 
            `<a href="${inv.asaas_payment_url}" target="_blank" class="btn-pay" style="display:inline-block; margin-left:1rem; font-size:0.8rem">Pagar</a>` 
            : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderPortalProfile() {
  const container = document.getElementById('profile-info-portal');
  const c = PORTAL.client;
  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
      <div><label style="color:#8E8D8C; font-size:0.7rem; text-transform:uppercase">Empresa/Nome</label><div>${escHtml(c.name)}</div></div>
      <div><label style="color:#8E8D8C; font-size:0.7rem; text-transform:uppercase">CPF/CNPJ</label><div>${escHtml(c.document || 'Não informado')}</div></div>
      <div><label style="color:#8E8D8C; font-size:0.7rem; text-transform:uppercase">E-mail</label><div>${escHtml(c.email || '—')}</div></div>
      <div><label style="color:#8E8D8C; font-size:0.7rem; text-transform:uppercase">WhatsApp</label><div>${escHtml(c.whatsapp || '—')}</div></div>
    </div>
  `;
}

function switchPortalTab(tabId) {
  // Tabs
  document.querySelectorAll('.portal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.portal-tab[data-tab="${tabId}"]`).classList.add('active');

  // Contents
  document.querySelectorAll('.portal-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById(`tab-${tabId}`).style.display = 'block';
}

function setupPortalRealtime() {
  const projIds = PORTAL.projects.map(p => p.id);
  
  // 1. Tasks
  if (projIds.length > 0) {
    supabase
      .channel('portal-tasks')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks',
        filter: `project_id=in.(${projIds.join(',')})`
      }, async () => {
        console.log('Task changed, refreshing portal...');
        await loadPortalData();
        renderPortalProjects();
      })
      .subscribe();
  }

  // 2. Notifications
  supabase
    .channel('portal-notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `client_id=eq.${PORTAL.client.id}`
    }, async (payload) => {
      console.log('New notification!', payload);
      if (!PORTAL.notifications) PORTAL.notifications = [];
      PORTAL.notifications.unshift(payload.new);
      renderNotifications();
      // Show alert if dropdown is closed
      const dropdown = document.getElementById('notif-dropdown');
      if (!dropdown || dropdown.style.display === 'none') {
        alert(`🔔 Nova Notificação: ${payload.new.title}`);
      }
    })
    .subscribe();

  console.log('Portal Realtime active — listening for tasks and notifications.');
}

function getTaskStatusClass(col) {
  if (col === 'done') return 'status-done';
  if (col === 'todo') return 'status-todo';
  return 'status-doing';
}

function logoutPortal() {
  localStorage.removeItem('higher_client_portal');
  window.location.reload();
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Check session on load
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('higher_client_portal');
  if (saved) {
    PORTAL.client = JSON.parse(saved);
    showPortal();
  }
});

// Global exposure
window.logoutPortal = logoutPortal;
window.switchPortalTab = switchPortalTab;
window.toggleNotifications = toggleNotifications;
window.markNotifRead = markNotifRead;
