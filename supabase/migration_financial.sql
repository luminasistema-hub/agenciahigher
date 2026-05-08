-- ============================================================
-- AGÊNCIA HIGHER — Migration Financeiro v1
-- Tabelas: invoices, invoice_items, payments, financial_settings
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. CONFIGURAÇÕES FINANCEIRAS DA AGÊNCIA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financial_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Dados bancários
  pix_key      TEXT,
  pix_type     TEXT CHECK (pix_type IN ('cpf','cnpj','email','telefone','aleatoria')),
  bank_name    TEXT,
  bank_agency  TEXT,
  bank_account TEXT,
  account_type TEXT DEFAULT 'corrente',
  -- Dados da empresa
  company_name TEXT DEFAULT 'Agência Higher',
  cnpj         TEXT,
  address      TEXT,
  phone        TEXT,
  email        TEXT,
  -- Asaas Integration
  asaas_api_key TEXT,
  asaas_wallet_id TEXT,
  asaas_webhook_token TEXT,
  asaas_sandbox BOOLEAN DEFAULT false,
  -- Config
  invoice_prefix TEXT DEFAULT 'HIGHER',
  next_invoice_number INTEGER DEFAULT 1,
  default_due_days INTEGER DEFAULT 7,  -- dias para vencimento padrão
  late_fee_pct NUMERIC(5,2) DEFAULT 2.00,  -- juros de mora %
  late_fee_daily NUMERIC(5,2) DEFAULT 0.033  -- multa diária %
);

-- Inserir config padrão
INSERT INTO public.financial_settings (company_name, invoice_prefix)
VALUES ('Agência Higher', 'HIGHER')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 1.5 PRODUTOS E SERVIÇOS (CATÁLOGO)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  name         TEXT NOT NULL,
  description  TEXT,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active    BOOLEAN DEFAULT true
);

-- ============================================================
-- 2. FATURAS (INVOICES)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  invoice_number  TEXT NOT NULL UNIQUE,   -- ex: HIGHER-2026-0001
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_id      UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  -- Valores
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(10,2) DEFAULT 0,
  discount_type   TEXT DEFAULT 'fixed' CHECK (discount_type IN ('fixed','percent')),
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Datas
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  paid_at         TIMESTAMPTZ,
  -- Status
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','partial','paid','overdue','cancelled')),
  -- Pagamento
  payment_method  TEXT CHECK (payment_method IN ('pix','boleto','transferencia','cartao','dinheiro','outro')),
  payment_ref     TEXT,   -- chave pix, nº boleto, etc.
  -- Recorrência e Asaas
  is_recurring    BOOLEAN DEFAULT false,
  recurrence      TEXT CHECK (recurrence IN ('monthly','quarterly','yearly')),
  asaas_invoice_id TEXT, -- ID da cobrança no Asaas
  asaas_subscription_id TEXT, -- ID da assinatura no Asaas
  asaas_payment_url TEXT, -- Link de pagamento do Asaas
  -- Metadados
  notes           TEXT,   -- notas internas
  client_notes    TEXT,   -- notas visíveis ao cliente
  sent_at         TIMESTAMPTZ,
  reminder_sent   BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS invoices_client_idx  ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx  ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_due_idx     ON public.invoices (due_date);
CREATE INDEX IF NOT EXISTS invoices_project_idx ON public.invoices (project_id);

-- ============================================================
-- 3. ITENS DA FATURA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     NUMERIC(8,2) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(10,2) NOT NULL,
  total        NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  position     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS items_invoice_idx ON public.invoice_items (invoice_id, position);

-- ============================================================
-- 4. PAGAMENTOS REGISTRADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  invoice_id   UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL,
  paid_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  method       TEXT CHECK (method IN ('pix','boleto','transferencia','cartao','dinheiro','outro')),
  reference    TEXT,   -- comprovante, nº transação
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS payments_invoice_idx ON public.payments (invoice_id);

-- ============================================================
-- 5. TRIGGER: updated_at automático
-- ============================================================
DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS financial_settings_updated_at ON public.financial_settings;
CREATE TRIGGER financial_settings_updated_at
  BEFORE UPDATE ON public.financial_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. FUNÇÃO: gerar número de fatura sequencial
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix TEXT;
  v_num    INTEGER;
  v_year   TEXT;
  v_result TEXT;
BEGIN
  SELECT invoice_prefix, next_invoice_number
  INTO v_prefix, v_num
  FROM public.financial_settings
  LIMIT 1;

  v_year   := TO_CHAR(NOW(), 'YYYY');
  v_result := v_prefix || '-' || v_year || '-' || LPAD(v_num::TEXT, 4, '0');

  UPDATE public.financial_settings
  SET next_invoice_number = next_invoice_number + 1;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 7. TRIGGER: auto-gerar invoice_number ao inserir
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_auto_number ON public.invoices;
CREATE TRIGGER invoices_auto_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.auto_invoice_number();

-- ============================================================
-- 8. FUNÇÃO: atualizar totais e status da fatura ao receber pagamento
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_invoice_on_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_paid NUMERIC;
  v_total      NUMERIC;
  v_due_date   DATE;
BEGIN
  SELECT COALESCE(SUM(amount), 0), i.total, i.due_date
  INTO v_total_paid, v_total, v_due_date
  FROM public.invoices i
  LEFT JOIN public.payments p ON p.invoice_id = i.id
  WHERE i.id = NEW.invoice_id
  GROUP BY i.total, i.due_date;

  IF v_total_paid >= v_total THEN
    UPDATE public.invoices
    SET amount_paid = v_total_paid,
        status = 'paid',
        paid_at = NOW()
    WHERE id = NEW.invoice_id;
  ELSE
    UPDATE public.invoices
    SET amount_paid = v_total_paid,
        status = CASE 
          WHEN v_due_date < CURRENT_DATE THEN 'overdue' 
          ELSE 'partial' 
        END
    WHERE id = NEW.invoice_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_update_invoice ON public.payments;
CREATE TRIGGER payments_update_invoice
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_on_payment();

-- ============================================================
-- 9. FUNÇÃO: marcar faturas vencidas (rodar periodicamente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.invoices
  SET status = 'overdue'
  WHERE status IN ('sent', 'partial')
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 10. VIEWS DE RELATÓRIO FINANCEIRO
-- ============================================================

-- Resumo mensal
CREATE OR REPLACE VIEW public.financial_monthly AS
SELECT
  DATE_TRUNC('month', issue_date)           AS month,
  COUNT(*)                                  AS total_invoices,
  COUNT(*) FILTER (WHERE status = 'paid')   AS paid_count,
  SUM(total)                                AS total_amount,
  SUM(amount_paid)                          AS total_received,
  SUM(total) FILTER (WHERE status IN ('sent','partial')) AS total_pending,
  SUM(total) FILTER (WHERE status = 'overdue')           AS total_overdue,
  ROUND(AVG(total), 2)                      AS avg_invoice
FROM public.invoices
WHERE status != 'cancelled' AND status != 'draft'
GROUP BY DATE_TRUNC('month', issue_date)
ORDER BY month DESC;

-- MRR por cliente
CREATE OR REPLACE VIEW public.client_mrr AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.plan,
  COUNT(i.id)              AS recurring_invoices,
  AVG(i.total)             AS avg_monthly_value,
  MAX(i.due_date)          AS last_due_date,
  MIN(i.status)            AS worst_status
FROM public.clients c
JOIN public.invoices i ON i.client_id = c.id
WHERE i.is_recurring = true AND i.status != 'cancelled'
GROUP BY c.id, c.name, c.plan;

-- Dashboard financeiro consolidado
CREATE OR REPLACE VIEW public.financial_dashboard AS
SELECT
  -- Este mês
  SUM(amount_paid) FILTER (
    WHERE DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', NOW())
  )::NUMERIC                                          AS received_this_month,
  -- Pendentes
  SUM(total - amount_paid) FILTER (
    WHERE status IN ('sent', 'partial')
  )::NUMERIC                                          AS total_pending,
  -- Vencidas
  SUM(total - amount_paid) FILTER (
    WHERE status = 'overdue'
  )::NUMERIC                                          AS total_overdue,
  -- Total emitido este ano
  SUM(total) FILTER (
    WHERE EXTRACT(YEAR FROM issue_date) = EXTRACT(YEAR FROM NOW())
    AND status != 'cancelled'
  )::NUMERIC                                          AS total_issued_year,
  -- Contagens
  COUNT(*) FILTER (WHERE status = 'paid')::INTEGER    AS count_paid,
  COUNT(*) FILTER (WHERE status = 'overdue')::INTEGER AS count_overdue,
  COUNT(*) FILTER (WHERE status IN ('sent','partial','draft'))::INTEGER AS count_pending
FROM public.invoices;

-- ============================================================
-- 11. RLS POLICIES
-- ============================================================
ALTER TABLE public.invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_invoices" ON public.invoices;
CREATE POLICY "admin_all_invoices"     ON public.invoices           FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_items" ON public.invoice_items;
CREATE POLICY "admin_all_items"        ON public.invoice_items      FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_payments" ON public.payments;
CREATE POLICY "admin_all_payments"     ON public.payments           FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_fin_settings" ON public.financial_settings;
CREATE POLICY "admin_all_fin_settings" ON public.financial_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'invoices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END $$;

COMMENT ON TABLE public.invoices          IS 'Faturas emitidas pela Agência Higher';
COMMENT ON TABLE public.invoice_items     IS 'Itens de cada fatura';
COMMENT ON TABLE public.payments          IS 'Pagamentos registrados por fatura';
COMMENT ON TABLE public.financial_settings IS 'Configurações financeiras da agência';
