-- ============================================================
-- AGÊNCIA HIGHER — Supabase Migration
-- Projeto: oimxnrtfidodrqwzabes
-- Execute este SQL no SQL Editor do painel Supabase
-- ============================================================

-- ============================================================
-- 1. TABELA: leads (resultados do quiz inteligente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  name            TEXT NOT NULL,
  whatsapp        TEXT NOT NULL,
  business_name   TEXT,
  recommended_plan TEXT NOT NULL CHECK (recommended_plan IN ('starter', 'growth', 'pro')),
  score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  answers         JSONB,          -- respostas completas do quiz
  utm_source      TEXT,           -- rastreamento de origem
  utm_medium      TEXT,
  utm_campaign    TEXT,
  status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'contacted', 'qualified', 'closed', 'lost')),
  notes           TEXT            -- notas internas do time
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS leads_created_at_idx   ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_plan_idx          ON public.leads (recommended_plan);
CREATE INDEX IF NOT EXISTS leads_status_idx        ON public.leads (status);
CREATE INDEX IF NOT EXISTS leads_whatsapp_idx      ON public.leads (whatsapp);

-- ============================================================
-- 2. TABELA: contacts (formulário de contato do site)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'replied', 'closed')),
  notes      TEXT
);

CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON public.contacts (created_at DESC);
CREATE INDEX IF NOT EXISTS contacts_status_idx     ON public.contacts (status);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

-- Habilitar RLS
ALTER TABLE public.leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- ---- LEADS RLS ----
-- Qualquer um pode inserir (visitante do site)
CREATE POLICY "leads_insert_public"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Apenas autenticados (admin) podem ler
CREATE POLICY "leads_select_admin"
  ON public.leads FOR SELECT
  TO authenticated
  USING (true);

-- Apenas autenticados podem atualizar (status, notas)
CREATE POLICY "leads_update_admin"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- CONTACTS RLS ----
CREATE POLICY "contacts_insert_public"
  ON public.contacts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "contacts_select_admin"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "contacts_update_admin"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. VIEW: resumo de leads por plano (útil para o painel)
-- ============================================================
CREATE OR REPLACE VIEW public.leads_summary AS
SELECT
  recommended_plan,
  COUNT(*)                                            AS total,
  COUNT(*) FILTER (WHERE status = 'new')              AS novos,
  COUNT(*) FILTER (WHERE status = 'contacted')        AS em_contato,
  COUNT(*) FILTER (WHERE status = 'qualified')        AS qualificados,
  COUNT(*) FILTER (WHERE status = 'closed')           AS fechados,
  ROUND(AVG(score), 1)                                AS score_medio,
  MAX(created_at)                                     AS ultimo_lead
FROM public.leads
GROUP BY recommended_plan
ORDER BY total DESC;

-- ============================================================
-- 5. FUNÇÃO: total de leads nas últimas 24h (para dashboard)
-- ============================================================
CREATE OR REPLACE FUNCTION public.leads_last_24h()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER FROM public.leads
  WHERE created_at >= now() - INTERVAL '24 hours';
$$;

-- ============================================================
-- Comentários nas tabelas
-- ============================================================
COMMENT ON TABLE public.leads    IS 'Leads capturados pelo quiz de diagnóstico do site Higher';
COMMENT ON TABLE public.contacts IS 'Contatos enviados pelo formulário do site Higher';
