/**
 * HIGHER CRM — MAIN ENTRY POINT
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';
import { LEADS } from './leads.js';

// We will import other modules here as we refactor them
import { CLIENTS } from './clients.js';
import { PROJECTS } from './projects.js';
import { DASHBOARD } from './dashboard.js';
import { CONTACTS } from './contacts.js';
import { UI } from './ui.js';
import { REALTIME } from './realtime.js';
import { BUDGETS } from './budgets.js';
import { KANBAN } from './kanban.js';
import { CONTRACTS } from './contracts.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Supabase from global (for now) or import it
  if (typeof getSupabase === 'function') {
    APP.db = getSupabase();
  }

  if (!APP.db) {
    console.error('[CRM] Supabase não disponível');
    return;
  }

  // Check session
  const { data: { session } } = await APP.db.auth.getSession();
  if (session) {
    APP.session = session;
    UI.showApp();
    await loadAll();
  } else {
    UI.showLogin();
  }

  // Auth state listener
  APP.db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      APP.session = session;
      UI.showApp();
      await loadAll();
    } else if (event === 'SIGNED_OUT') {
      APP.session = null;
      UI.showLogin();
    }
  });

  UI.setup();
  UTILS.updateClock();
  setInterval(UTILS.updateClock, 30000);
});

async function loadAll() {
  await Promise.all([
    LEADS.load(),
    CLIENTS.load(),
    PROJECTS.load(),
    CONTACTS.load(),
    BUDGETS.load(),
    CONTRACTS.load(),
  ]);
  
  await DASHBOARD.load();

  if (!APP._realtimeStarted) {
    APP._realtimeStarted = true;
    REALTIME.start();
  }
}

// Global Exposure for legacy HTML handlers (onclick/onchange)
window.loadAll = loadAll;
window.closeModal = (id) => UTILS.closeModal(id);
window.openModal = (id) => UTILS.openModal(id);
window.toast = (msg, type) => UTILS.toast(msg, type);

// View Switching Extension
const originalSwitchView = window.switchView;
window.switchView = async (viewId) => {
  if (originalSwitchView) originalSwitchView(viewId);
  if (viewId === 'contracts') CONTRACTS.load();
};
