/* ============================================================
   SUPABASE CLIENT — Agência Higher
   ============================================================ */

const SUPABASE_URL  = 'https://oimxnrtfidodrqwzabes.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbXhucnRmaWRvZHJxd3phYmVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNTU4OTEsImV4cCI6MjA5MjgzMTg5MX0.MARgHNmX9KI7vBOLxfkMH-icKpglL2DykCJgFkgcSho';

let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  if (typeof supabase === 'undefined') {
    console.warn('[Higher] Supabase SDK não carregado.');
    return null;
  }
  _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _supabase;
}

/* ─── FALLBACK LOCAL ───────────────────────────────────────────
   Salva leads no localStorage caso haja falha pontual de rede   */
function _saveLeadLocally(payload) {
  try {
    const stored = JSON.parse(localStorage.getItem('higher_leads_offline') || '[]');
    stored.push({ ...payload, saved_at: new Date().toISOString() });
    localStorage.setItem('higher_leads_offline', JSON.stringify(stored));
    console.info('[Higher] 💾 Lead salvo localmente como fallback. Total:', stored.length);
  } catch (e) {
    console.warn('[Higher] Não foi possível salvar localmente:', e);
  }
}

/* ============================================================
   UTM HELPERS
   ============================================================ */
function getUTMParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source:   params.get('utm_source')   || null,
    utm_medium:   params.get('utm_medium')   || null,
    utm_campaign: params.get('utm_campaign') || null,
  };
}

/* ============================================================
   LEAD: Salvar resultado do quiz
   ============================================================ */
async function saveLead({ name, email, whatsapp, businessName, plan, score, answers, document, project_details, selected_plan, recommended_project }) {
  // Mapeia o ID do projeto para um valor aceito pelo check constraint do banco
  // (mantém compatibilidade sem precisar alterar o schema)
  const PROJECT_TO_PLAN = {
    site:      'starter',
    branding:  'starter',
    lp:        'starter',
    funil:     'growth',
    ecommerce: 'growth',
    sistema:   'pro',
    app:       'pro',
    automacao: 'pro',
  };
  const planValue = PROJECT_TO_PLAN[recommended_project] || plan || 'starter';

  const payload = {
    name,
    email:            email || null,
    whatsapp,
    business_name:    businessName || null,
    recommended_plan: planValue,               // valor aceito pelo check constraint
    selected_plan:    recommended_project || selected_plan || null, // ID real do projeto
    score:            score ?? 0,
    answers:          answers || null,
    status:           'new',
    document:         document || null,
    project_details:  project_details || null,
    ...getUTMParams(),
  };

  const db = getSupabase();
  if (!db) {
    _saveLeadLocally(payload);
    return { error: null };
  }

  try {
    const { data, error } = await db
      .from('leads')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('[Higher] Erro ao salvar lead no DB:', error.message);
      _saveLeadLocally(payload); // fallback de segurança
    } else {
      console.log('[Higher] ✅ Lead salvo no Supabase:', data.id);
    }
    return { data, error };
  } catch (err) {
    console.warn('[Higher] Falha de rede ao salvar lead:', err.message);
    _saveLeadLocally(payload);
    return { error: null };
  }
}

// Alias para compatibilidade
const saveQuizLead = saveLead;

/* ============================================================
   CONTACT: Salvar mensagem do formulário
   ============================================================ */
async function saveContact({ name, email, phone, message }) {
  const db = getSupabase();
  if (!db) return { error: 'Supabase não disponível' };

  const payload = { name, email, phone: phone || null, message, status: 'new' };

  try {
    const { data, error } = await db
      .from('contacts')
      .insert([payload])
      .select()
      .single();

    if (error) console.warn('[Higher] Erro ao salvar contato:', error.message);
    else console.log('[Higher] ✅ Contato salvo:', data.id);
    return { data, error };
  } catch (err) {
    console.warn('[Higher] Falha ao salvar contato:', err.message);
    return { error: err };
  }
}

/* ============================================================
   ADMIN: Buscar leads
   ============================================================ */
async function fetchLeads({ page = 1, perPage = 20, plan = null, status = null } = {}) {
  const db = getSupabase();
  if (!db) return { data: [], count: 0, error: 'Supabase não disponível' };

  let query = db
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (plan)   query = query.eq('recommended_plan', plan);
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  return { data: data || [], count: count || 0, error };
}

async function fetchContacts({ page = 1, perPage = 20 } = {}) {
  const db = getSupabase();
  if (!db) return { data: [], count: 0, error: 'Supabase não disponível' };

  const { data, error, count } = await db
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  return { data: data || [], count: count || 0, error };
}

async function updateLeadStatus(id, status, notes = null) {
  const db = getSupabase();
  if (!db) return { error: 'Supabase não disponível' };

  const updates = { status };
  if (notes !== null) updates.notes = notes;

  const { data, error } = await db
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

/* ============================================================
   ADMIN AUTH
   ============================================================ */
async function adminSignIn(email, password) {
  const db = getSupabase();
  if (!db) return { error: 'Supabase não disponível' };
  return db.auth.signInWithPassword({ email, password });
}

async function adminSignOut() {
  const db = getSupabase();
  if (!db) return;
  return db.auth.signOut();
}

async function getAdminSession() {
  const db = getSupabase();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  return data?.session || null;
}
