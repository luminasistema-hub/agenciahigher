-- ============================================================
-- AGÊNCIA HIGHER — Migration Leads v2 (Qualification Funnel)
-- Adicionando campos para captura detalhada de leads via planos
-- ============================================================

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS document TEXT,
ADD COLUMN IF NOT EXISTS project_details TEXT,
ADD COLUMN IF NOT EXISTS selected_plan TEXT;

-- Garantir que o RLS permita a inserção desses novos campos
-- (A política leads_insert_public já permite inserir qualquer campo se não houver restrição específica)

COMMENT ON COLUMN public.leads.project_details IS 'Detalhes do projeto/negócio capturados no modal de plano';
COMMENT ON COLUMN public.leads.selected_plan IS 'Plano que o lead selecionou no site';
