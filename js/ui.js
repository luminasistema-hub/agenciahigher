/**
 * HIGHER CRM — UI MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';
import { FINANCIAL } from './financial.js';
import { BUDGETS } from './budgets.js';

export const UI = {
  setup() {
    // Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => this.switchView(btn.dataset.view));
    });

    // Sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('mobile-open');
    });

    // Close mobile menu when clicking outside
    document.getElementById('main-content')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('mobile-open');
    });

    // Refresh
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      if (window.loadAll) window.loadAll();
      UTILS.toast('Dados atualizados!', 'success');
    });

    // Kanban project select
    document.getElementById('kanban-project-select')?.addEventListener('change', (e) => {
      const projectId = e.target.value;
      APP.kanban.selectedProjectId = projectId;
      
      const btn = document.getElementById('btn-new-task');
      if (btn) btn.disabled = !projectId;

      if (projectId && window.loadKanban) {
        window.loadKanban(projectId);
      } else {
        const board = document.getElementById('kanban-board');
        if (board) board.innerHTML = '<div class="kanban-empty">👈 Selecione um projeto para ver o Kanban</div>';
      }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) UTILS.closeModal(overlay.id);
      });
    });

    // Login Form
    document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));

    this.setupForms();
  },

  setupForms() {
    // Client form
    document.getElementById('client-form')?.addEventListener('submit', (e) => {
      if (window.handleSaveClient) window.handleSaveClient(e);
    });

    // Project form
    document.getElementById('project-form')?.addEventListener('submit', (e) => {
      if (window.handleSaveProject) window.handleSaveProject(e);
    });

    // Task form
    document.getElementById('task-form')?.addEventListener('submit', (e) => {
      if (window.handleSaveTask) window.handleSaveTask(e);
    });
  },

  switchView(view) {
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
      budgets: '📄 Orçamentos',
    };
    const titleEl = document.getElementById('view-title');
    if (titleEl) titleEl.textContent = titles[view] || view;

    // Load financial data on first visit
    if (view === 'financial') {
      FINANCIAL.load();
    }
    if (view === 'budgets') {
      BUDGETS.load();
    }

    document.getElementById('sidebar')?.classList.remove('mobile-open');
  },

  showLogin() {
    const loginScreen = document.getElementById('login-screen');
    const adminApp = document.getElementById('admin-app');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (adminApp) adminApp.style.display = 'none';
  },

  showApp() {
    const loginScreen = document.getElementById('login-screen');
    const adminApp = document.getElementById('admin-app');
    if (loginScreen) loginScreen.style.display = 'none';
    if (adminApp) adminApp.style.display = 'flex';
    
    const user = APP.session?.user;
    if (user) {
      const email = user.email || '';
      const nameEl = document.getElementById('user-name');
      const avatarEl = document.getElementById('user-avatar');
      if (nameEl) nameEl.textContent = email.split('@')[0];
      if (avatarEl) avatarEl.textContent = email.charAt(0).toUpperCase();
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');
    const errEl = document.getElementById('login-error');

    if (btn) {
      btn.textContent = 'Entrando...';
      btn.disabled = true;
    }
    if (errEl) errEl.style.display = 'none';

    const { error } = await APP.db.auth.signInWithPassword({ email, password });

    if (error) {
      if (errEl) {
        errEl.textContent = 'E-mail ou senha inválidos.';
        errEl.style.display = 'block';
      }
      if (btn) {
        btn.textContent = 'Entrar no Painel';
        btn.disabled = false;
      }
    }
  }
};

// Global Exposure
window.switchView = (view) => UI.switchView(view);
window.showLogin = () => UI.showLogin();
window.showApp = () => UI.showApp();
window.setupUI = () => UI.setup();
