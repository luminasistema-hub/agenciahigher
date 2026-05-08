-- ============================================================
-- AGÊNCIA HIGHER — Habilitar Realtime
-- Execute no SQL Editor do Supabase
-- Permite que o admin.html receba leads em tempo real
-- ============================================================

-- Adiciona as tabelas ao publication do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;

-- Verifica quais tabelas estão no realtime (opcional)
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
