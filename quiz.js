/* ============================================================
   QUIZ JS — AGÊNCIA HIGHER
   Diagnóstico de Projeto Personalizado
   ============================================================ */

'use strict';

// ─── PERGUNTAS ───────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'q-stage',
    category: 'Presença Digital',
    text: 'Qual o estágio atual do seu negócio no mundo digital?',
    hint: 'Isso nos ajuda a entender o ponto de partida ideal para sua estratégia.',
    options: [
      { id: 'zero',     label: 'Ainda não tenho presença digital',             emoji: '🌱', tags: ['site', 'branding'] },
      { id: 'social',   label: 'Só tenho redes sociais (Instagram, WhatsApp)', emoji: '📱', tags: ['site', 'lp'] },
      { id: 'basic',    label: 'Tenho um site desatualizado ou básico',         emoji: '🌐', tags: ['site', 'lp', 'sistema'] },
      { id: 'advanced', label: 'Tenho presença consolidada e quero evoluir',   emoji: '🚀', tags: ['sistema', 'app', 'automacao'] }
    ]
  },
  {
    id: 'q-goal',
    category: 'Objetivo Principal',
    text: 'Qual é o principal objetivo do seu negócio nos próximos meses?',
    hint: 'Escolha a opção que melhor representa sua prioridade agora.',
    options: [
      { id: 'visibility', label: 'Ser encontrado no Google e nas redes',          emoji: '🔍', tags: ['site', 'branding'] },
      { id: 'leads',      label: 'Gerar mais leads e contatos qualificados',      emoji: '💬', tags: ['lp', 'funil'] },
      { id: 'sales',      label: 'Vender mais — online ou presencialmente',       emoji: '💰', tags: ['ecommerce', 'lp', 'sistema'] },
      { id: 'operations', label: 'Organizar e automatizar operações internas',    emoji: '⚙️', tags: ['sistema', 'app', 'automacao'] }
    ]
  },
  {
    id: 'q-segment',
    category: 'Segmento de Mercado',
    text: 'Em qual segmento sua empresa atua?',
    hint: 'Temos projetos entregues em cada um desses mercados.',
    options: [
      { id: 'food',      label: 'Restaurante / Alimentação',         emoji: '🍽️', tags: ['lp', 'ecommerce', 'sistema'] },
      { id: 'beauty',    label: 'Beleza / Estética / Saúde',         emoji: '💇', tags: ['site', 'sistema'] },
      { id: 'services',  label: 'Serviços / Consultoria / B2B',      emoji: '🏢', tags: ['site', 'lp', 'automacao'] },
      { id: 'ecommerce', label: 'Loja / E-commerce / Produtos',      emoji: '🛍️', tags: ['ecommerce', 'lp'] },
      { id: 'education', label: 'Educação / Cursos / Treinamentos',  emoji: '🎓', tags: ['lp', 'funil', 'app'] },
      { id: 'church',    label: 'Igreja / Associação / ONG',         emoji: '🏛️', tags: ['site', 'sistema', 'app'] },
      { id: 'other',     label: 'Outro segmento',                    emoji: '🔧', tags: ['site', 'lp'] }
    ]
  },
  {
    id: 'q-pain',
    category: 'Maior Dificuldade',
    text: 'Qual é a sua maior dificuldade hoje?',
    hint: 'Quanto mais honesto, melhor o projeto recomendado.',
    options: [
      { id: 'invisible', label: 'Meu negócio não é encontrado online',            emoji: '🙈', tags: ['site', 'branding'] },
      { id: 'lowleads',  label: 'Tenho pouco ou nenhum lead chegando',            emoji: '📉', tags: ['lp', 'funil'] },
      { id: 'noconvert', label: 'Tenho visitantes mas não converto em vendas',   emoji: '😔', tags: ['lp', 'funil', 'ecommerce'] },
      { id: 'manual',    label: 'Perco tempo com processos manuais e retrabalho', emoji: '🤯', tags: ['sistema', 'automacao', 'app'] }
    ]
  },
  {
    id: 'q-deliverable',
    category: 'Solução Desejada',
    text: 'O que você imagina que seu negócio precisa agora?',
    hint: 'Pode ser mais de uma coisa — escolha a mais urgente.',
    options: [
      { id: 'site',    label: 'Um site ou landing page profissional',      emoji: '🌐', tags: ['site', 'lp'] },
      { id: 'funnel',  label: 'Um funil de captação de clientes online',   emoji: '🎯', tags: ['lp', 'funil', 'automacao'] },
      { id: 'booking', label: 'Sistema de agendamento, pedidos ou gestão', emoji: '📅', tags: ['sistema', 'app'] },
      { id: 'custom',  label: 'Uma solução digital sob medida / plataforma', emoji: '⚡', tags: ['app', 'sistema', 'automacao'] }
    ]
  }
];

// ─── PROJETOS DISPONÍVEIS ─────────────────────────────────────
// Cada projeto tem tags de afinidade, nome, descrição e prazo estimado
const PROJECTS = {
  site: {
    id: 'site',
    badge: 'PROJETO RECOMENDADO',
    emoji: '🌐',
    name: 'Site Institucional Profissional',
    tagline: 'Presença digital que gera credibilidade e vende no automático.',
    description: 'Criamos um site sob medida para o seu negócio: design premium, rápido, otimizado para o Google (SEO), com formulários de captura integrados ao WhatsApp e adaptado para todos os dispositivos.',
    includes: [
      '✅ Design exclusivo para sua marca',
      '✅ Até 8 páginas otimizadas para SEO',
      '✅ Integração com WhatsApp e formulário de leads',
      '✅ Hospedagem configurada e certificado SSL',
      '✅ Painel para você gerenciar conteúdo'
    ],
    deadline: '15 a 25 dias úteis'
  },
  lp: {
    id: 'lp',
    badge: 'PROJETO RECOMENDADO',
    emoji: '🎯',
    name: 'Landing Page de Alta Conversão',
    tagline: 'Uma página focada em um único objetivo: transformar visitas em clientes.',
    description: 'Desenvolvemos uma landing page estratégica com copywriting de alta conversão, prova social, gatilhos mentais e integração com tráfego pago (Google Ads / Meta Ads) para gerar leads e vendas de forma previsível.',
    includes: [
      '✅ Design e copy estratégico orientado a conversão',
      '✅ Integração com ferramentas de automação (RD, HubSpot)',
      '✅ Pixel de conversão configurado (Meta/Google)',
      '✅ Testes A/B e análise de dados inclusos',
      '✅ Suporte na campanha de lançamento'
    ],
    deadline: '7 a 14 dias úteis'
  },
  funil: {
    id: 'funil',
    badge: 'PROJETO RECOMENDADO',
    emoji: '📐',
    name: 'Funil de Vendas Digital',
    tagline: 'Uma jornada automatizada que leva o lead do interesse à compra.',
    description: 'Estruturamos um funil completo: da atração (tráfego), passando pela captura (landing page), nutrição (e-mail/WhatsApp) e conversão (oferta irresistível). Tudo integrado e automatizado para funcionar 24h.',
    includes: [
      '✅ Landing Page + página de obrigado',
      '✅ Sequência de automação por e-mail/WhatsApp',
      '✅ Configuração de CRM com pipeline de vendas',
      '✅ Integração com tráfego pago',
      '✅ Dashboard de métricas e conversões'
    ],
    deadline: '20 a 35 dias úteis'
  },
  ecommerce: {
    id: 'ecommerce',
    badge: 'PROJETO RECOMENDADO',
    emoji: '🛍️',
    name: 'Loja Virtual (E-commerce)',
    tagline: 'Sua loja online pronta para vender produtos físicos ou digitais.',
    description: 'Criamos uma loja virtual completa, integrada com meios de pagamento (PIX, cartão, boleto), gestão de estoque, cálculo de frete e painel administrativo intuitivo para você gerenciar tudo sem depender de ninguém.',
    includes: [
      '✅ Loja virtual com design exclusivo',
      '✅ Integração com Mercado Pago, Stripe, PagBank',
      '✅ Gestão de produtos, estoque e pedidos',
      '✅ Integração com marketplaces (Mercado Livre, etc.)',
      '✅ SEO e configuração de Google Shopping'
    ],
    deadline: '25 a 40 dias úteis'
  },
  sistema: {
    id: 'sistema',
    badge: 'PROJETO RECOMENDADO',
    emoji: '⚙️',
    name: 'Sistema Web Personalizado',
    tagline: 'Automatize processos, gerencie sua equipe e escale com tecnologia.',
    description: 'Desenvolvemos sistemas web sob medida para as necessidades do seu negócio: agendamento online, gestão de clientes, controle financeiro, CRM, portal de membros e muito mais. Sua operação no controle total.',
    includes: [
      '✅ Levantamento e mapeamento de requisitos',
      '✅ Desenvolvimento com tecnologia moderna e escalável',
      '✅ Painel administrativo com permissões de acesso',
      '✅ Integrações com APIs externas (pagamento, WhatsApp)',
      '✅ Suporte técnico contínuo pós-entrega'
    ],
    deadline: '30 a 60 dias úteis (conforme escopo)'
  },
  app: {
    id: 'app',
    badge: 'PROJETO RECOMENDADO',
    emoji: '📱',
    name: 'Aplicativo Mobile / PWA',
    tagline: 'Uma experiência nativa no celular dos seus clientes e colaboradores.',
    description: 'Desenvolvemos aplicativos móveis e Progressive Web Apps (PWA) que funcionam em iOS e Android. Ideal para empresas que querem oferecer uma experiência diferenciada, fidelizar clientes ou digitalizar operações de campo.',
    includes: [
      '✅ App para iOS e Android (ou PWA multiplataforma)',
      '✅ UI/UX design premium orientado ao usuário',
      '✅ Notificações push e recursos offline',
      '✅ Painel de gestão e relatórios',
      '✅ Publicação nas lojas (App Store / Google Play)'
    ],
    deadline: '45 a 90 dias úteis (conforme escopo)'
  },
  automacao: {
    id: 'automacao',
    badge: 'PROJETO RECOMENDADO',
    emoji: '🤖',
    name: 'Automação & IA para o seu Negócio',
    tagline: 'Elimine tarefas repetitivas e deixe a tecnologia trabalhar por você.',
    description: 'Implementamos fluxos de automação inteligentes: atendimento via WhatsApp com IA, integração entre ferramentas (CRM, ERP, e-mail), geração automática de relatórios, chatbots e muito mais.',
    includes: [
      '✅ Diagnóstico e mapeamento de processos',
      '✅ Chatbot com IA para WhatsApp/site',
      '✅ Automações com Make, n8n ou Zapier',
      '✅ Integração entre seus sistemas atuais',
      '✅ Treinamento da equipe e documentação'
    ],
    deadline: '15 a 30 dias úteis'
  },
  branding: {
    id: 'branding',
    badge: 'PROJETO RECOMENDADO',
    emoji: '🎨',
    name: 'Identidade Visual + Presença Digital',
    tagline: 'Sua marca com a identidade que merece — do logo ao digital.',
    description: 'Para quem está começando do zero ou quer reposicionar sua marca. Criamos sua identidade visual completa e estruturamos toda a sua presença digital: logo, paleta, tipografia, perfis nas redes e site.',
    includes: [
      '✅ Criação de logotipo profissional (3 opções)',
      '✅ Manual de identidade visual',
      '✅ Criação e otimização dos perfis nas redes',
      '✅ Site institucional incluso',
      '✅ Kit de artes para redes sociais'
    ],
    deadline: '20 a 30 dias úteis'
  }
};

// ─── LÓGICA DE RECOMENDAÇÃO ───────────────────────────────────
// Pontua cada tag de projeto com base nas respostas
function getRecommendedProject(answers) {
  const tagScore = {};

  for (const qId in answers) {
    const tags = answers[qId].tags || [];
    tags.forEach(tag => {
      tagScore[tag] = (tagScore[tag] || 0) + 1;
    });
  }

  // Ordena por pontuação
  const sorted = Object.entries(tagScore).sort((a, b) => b[1] - a[1]);
  const topTag = sorted[0]?.[0] || 'site';

  return PROJECTS[topTag] || PROJECTS.site;
}

// ─── ESTADO ───────────────────────────────────────────────────
let currentStep = 0;
let answers = {}; // { qId: { label, tags } }

// ─── INICIAR QUIZ ─────────────────────────────────────────────
function startQuiz() {
  document.getElementById('screen-intro').classList.remove('active');
  document.getElementById('screen-questions').classList.add('active');
  renderQuestion();
}

// ─── RENDERIZAR PERGUNTA ──────────────────────────────────────
function renderQuestion() {
  const q = QUESTIONS[currentStep];

  // Número e categoria
  const numEl = document.getElementById('q-num');
  const catEl = document.getElementById('q-category');
  const hintEl = document.getElementById('q-hint');
  if (numEl) numEl.textContent = String(currentStep + 1).padStart(2, '0');
  if (catEl) catEl.textContent = q.category || 'Diagnóstico';
  if (hintEl) hintEl.textContent = q.hint || '';

  // Pergunta
  document.getElementById('question-text').textContent = q.text;

  // Opções
  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  grid.className = `options-grid cols-2`; // Sempre cards 2x2 ou list em mobile via CSS

  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-card';
    btn.innerHTML = `
      <span class="option-emoji">${opt.emoji}</span>
      <div class="option-content">
        <span class="option-label">${opt.label}</span>
      </div>
      <span class="option-check">✓</span>
    `;
    btn.onclick = () => selectOption(q.id, opt, btn);
    grid.appendChild(btn);
  });

  // Dots de navegação
  renderDots();
  updateProgress();
}

function renderDots() {
  const dotsEl = document.getElementById('q-dots');
  if (!dotsEl) return;
  dotsEl.innerHTML = QUESTIONS.map((_, i) => {
    let cls = 'q-dot';
    if (i === currentStep) cls += ' active';
    else if (i < currentStep) cls += ' done';
    return `<span class="${cls}"></span>`;
  }).join('');
}

// ─── SELECIONAR OPÇÃO ─────────────────────────────────────────
function selectOption(qId, opt, btn) {
  answers[qId] = { label: opt.label, tags: opt.tags };

  // Animação de seleção
  const allCards = document.querySelectorAll('.option-card');
  allCards.forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');

  if (currentStep < QUESTIONS.length - 1) {
    setTimeout(() => {
      currentStep++;
      renderQuestion();
    }, 450); // Delay maior para o usuário ver a seleção
  } else {
    setTimeout(showLeadForm, 450);
  }
}

// ─── PROGRESSO ───────────────────────────────────────────────
function updateProgress() {
  const total = QUESTIONS.length + 1; // +1 para o formulário de lead
  const pct = (currentStep / total) * 100;
  document.getElementById('quiz-progress').style.width = `${pct}%`;
  document.getElementById('quiz-step-indicator').textContent = `Passo ${currentStep + 1} de ${QUESTIONS.length}`;
}

// ─── EXIBIR FORMULÁRIO ────────────────────────────────────────
function showLeadForm() {
  document.getElementById('screen-questions').classList.remove('active');
  document.getElementById('screen-lead').classList.add('active');
  document.getElementById('quiz-progress').style.width = '90%';
  document.getElementById('quiz-step-indicator').textContent = 'Quase lá!';
  
  // Rolar para o topo do formulário
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── ANALISADOR DE LEAD INTERNO (SIMULADO DO AI_SCORER) ───────
function calculateAIScore(leadData) {
  let score = 30; // Base
  const msg = (leadData.project_details || '').toLowerCase();
  
  // Palavras HOT
  if (msg.includes('urgente') || msg.includes('agora') || msg.includes('fechar') || msg.includes('investir')) score += 40;
  if (leadData.name.toLowerCase().includes('diretor') || leadData.name.toLowerCase().includes('ceo')) score += 20;
  if (leadData.whatsapp) score += 10;
  
  return Math.min(100, score);
}

// ─── SUBMIT DO FORMULÁRIO ─────────────────────────────────────
document.getElementById('quiz-lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const recommended = getRecommendedProject(answers);

  const leadData = {
    name:             document.getElementById('lead-name').value,
    email:            document.getElementById('lead-email').value,
    whatsapp:         document.getElementById('lead-whatsapp').value,
    document:         document.getElementById('lead-doc').value,
    project_details:  document.getElementById('lead-details').value,
    recommended_project: recommended.id,
    answers:          answers,
    status:           'new'
  };

  const btn = document.getElementById('btn-submit-quiz');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Processando seu diagnóstico...';
  }

  showLoading(true);

  // Calcula Score via "IA" local para agilizar
  const aiScore = calculateAIScore(leadData);

  try {
    console.log('[Quiz] Enviando lead para o sistema...', leadData.name);
    
    // Tenta salvar, mas não deixa o usuário esperando se o DB estiver lento
    saveLead({
      name:                leadData.name,
      email:               leadData.email,
      whatsapp:            leadData.whatsapp,
      document:            leadData.document,
      project_details:     leadData.project_details,
      recommended_project: recommended.id,
      answers:             leadData.answers,
      score:               aiScore
    }).catch(e => console.warn('[Quiz] Erro silencioso no saveLead:', e));

    // Mostra o resultado após um delay mínimo para "efeito de processamento"
    setTimeout(() => {
      showLoading(false);
      showResult(recommended);
      console.log('[Quiz] Sucesso! Resultado exibido.');
    }, 1200);

  } catch (err) {
    console.error('[Quiz] Erro crítico no envio:', err);
    showLoading(false);
    showResult(recommended); // Mostra o resultado mesmo se der erro no log
  }
});

// ─── EXIBIR RESULTADO ─────────────────────────────────────────
function showResult(project) {
  document.getElementById('screen-lead').classList.remove('active');
  document.getElementById('screen-result').classList.add('active');
  document.getElementById('quiz-progress').style.width = '100%';
  document.getElementById('quiz-step-indicator').textContent = 'Diagnóstico concluído!';

  const badge = document.getElementById('result-badge');
  const title = document.getElementById('result-title');
  const desc  = document.getElementById('result-description');
  const cta   = document.getElementById('result-cta-btn');

  badge.textContent = project.badge;
  title.textContent = `${project.emoji} ${project.name}`;

  const includesList = project.includes.map(i => `<li>${i}</li>`).join('');

  desc.innerHTML = `
    <p class="result-tagline-txt">${project.tagline}</p>
    <p class="result-project-desc">${project.description}</p>
    <div class="result-includes-block">
      <p class="result-includes-title">O QUE ESTÁ INCLUSO</p>
      <ul class="result-includes-list">${includesList}</ul>
    </div>
    <div class="result-meta">
      <span class="result-deadline">⏱ Prazo estimado: <strong>${project.deadline}</strong></span>
    </div>
  `;

  const waMsg = encodeURIComponent(
    `Olá! Fiz o diagnóstico da Higher e o projeto recomendado foi: *${project.name}*. Gostaria de conversar sobre o meu projeto! 🚀`
  );
  cta.href = `https://wa.me/5563984861923?text=${waMsg}`;
  cta.textContent = 'Falar com Especialista no WhatsApp 💬';
}

// ─── LOADING ──────────────────────────────────────────────────
function showLoading(show) {
  const loader = document.getElementById('quiz-loading');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}
