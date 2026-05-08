/**
 * HIGHER CRM — CENTRAL STATE
 */

export const APP = {
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
  },
  _realtimeStarted: false
};

/**
 * Global Constants
 */
export const QUESTION_MAP = {
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
