-- Executar este script no SQL Editor do Supabase irá matar transações travadas
-- que podem estar bloqueando a tabela financial_settings.

SELECT pg_terminate_backend(a.pid)
FROM pg_stat_activity a
JOIN pg_locks l ON l.pid = a.pid
WHERE l.relation = 'public.financial_settings'::regclass
  AND a.pid <> pg_backend_pid();
