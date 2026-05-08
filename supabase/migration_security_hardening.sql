-- ============================================================
-- AGÊNCIA HIGHER — Security Hardening (RLS)
-- Garante que clientes autenticados vejam APENAS seus dados.
-- ============================================================

-- 1. Remover políticas genéricas anteriores (se existirem)
DROP POLICY IF EXISTS "client_view_own" ON public.clients;
DROP POLICY IF EXISTS "client_view_own_projects" ON public.projects;
DROP POLICY IF EXISTS "client_view_own_invoices" ON public.invoices;
DROP POLICY IF EXISTS "client_view_own_deliverables" ON public.deliverables;

-- 2. Política para CLIENTS: Cliente vê seu próprio perfil
CREATE POLICY "client_view_own" ON public.clients
FOR SELECT TO authenticated
USING (auth.uid() = auth_user_id);

-- 3. Política para PROJECTS: Cliente vê projetos vinculados ao seu ID
CREATE POLICY "client_view_own_projects" ON public.projects
FOR SELECT TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
  )
);

-- 4. Política para INVOICES: Cliente vê faturas vinculadas ao seu ID
CREATE POLICY "client_view_own_invoices" ON public.invoices
FOR SELECT TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
  )
);

-- 5. Política para DELIVERABLES: Cliente vê entregas de seus projetos
CREATE POLICY "client_view_own_deliverables" ON public.deliverables
FOR SELECT TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  )
);

-- 6. Política para FEEDBACK (UPDATE): Cliente pode salvar feedbacks em suas entregas
CREATE POLICY "client_update_own_deliverables" ON public.deliverables
FOR UPDATE TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  )
);

-- NOTA: Os Admins continuam vendo tudo devido às políticas "admin_all_..." 
-- definidas anteriormente em migration_portal.sql (authenticated sem restrição).
