-- ============================================================
-- AGÊNCIA HIGHER — Migration Portal v2
-- Tabelas: clients, projects, kanban_columns, tasks,
--          deliverables, task_comments
-- Execute APÓS migration.sql
-- ============================================================

-- ============================================================
-- 1. CLIENTS (clientes oficiais da agência)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  name          TEXT NOT NULL,
  email         TEXT,
  whatsapp      TEXT,
  company       TEXT,
  plan          TEXT CHECK (plan IN ('starter', 'growth', 'pro')),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'churned', 'prospect')),
  avatar_color  TEXT DEFAULT '#7C3AED',
  notes         TEXT,
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  auth_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL  -- login do cliente
);

CREATE INDEX IF NOT EXISTS clients_status_idx  ON public.clients (status);
CREATE INDEX IF NOT EXISTS clients_plan_idx    ON public.clients (plan);
CREATE INDEX IF NOT EXISTS clients_lead_idx    ON public.clients (lead_id);

-- ============================================================
-- 2. PROJECTS (projetos por cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  plan         TEXT CHECK (plan IN ('starter', 'growth', 'pro')),
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  deadline     DATE,
  progress     INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  color        TEXT DEFAULT '#FF6B1A'
);

CREATE INDEX IF NOT EXISTS projects_client_idx  ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx  ON public.projects (status);

-- ============================================================
-- 3. KANBAN COLUMNS (colunas do quadro)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  color       TEXT DEFAULT '#7C3AED',
  icon        TEXT DEFAULT '📋'
);

CREATE INDEX IF NOT EXISTS kanban_col_project_idx ON public.kanban_columns (project_id, position);

-- ============================================================
-- 4. TASKS (cards do kanban)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  column_id    UUID NOT NULL REFERENCES public.kanban_columns(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  priority     TEXT NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date     DATE,
  tags         TEXT[] DEFAULT '{}',
  position     INTEGER NOT NULL DEFAULT 0,
  is_visible_to_client BOOLEAN DEFAULT true  -- cliente pode ver?
);

CREATE INDEX IF NOT EXISTS tasks_project_idx ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_column_idx  ON public.tasks (column_id, position);

-- ============================================================
-- 5. TASK COMMENTS (comentários nas tarefas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'admin' CHECK (author_role IN ('admin', 'client')),
  content     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS comments_task_idx ON public.task_comments (task_id, created_at);

-- ============================================================
-- 6. DELIVERABLES (entregas visíveis ao cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deliverables (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'in_review', 'approved', 'delivered')),
  delivery_url TEXT,
  delivery_date DATE,
  icon         TEXT DEFAULT '📦'
);

CREATE INDEX IF NOT EXISTS deliverables_project_idx ON public.deliverables (project_id);

-- ============================================================
-- 7. TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER clients_updated_at  BEFORE UPDATE ON public.clients  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tasks_updated_at    BEFORE UPDATE ON public.tasks    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 8. RLS POLICIES
-- ============================================================
ALTER TABLE public.clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

-- Admin (authenticated sem client_id) vê tudo
CREATE POLICY "admin_all_clients"       ON public.clients       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_projects"      ON public.projects      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_columns"       ON public.kanban_columns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_tasks"         ON public.tasks         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_comments"      ON public.task_comments  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_deliverables"  ON public.deliverables  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 9. DEFAULT KANBAN COLUMNS (helper function)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_default_columns(p_project_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.kanban_columns (project_id, name, position, color, icon) VALUES
    (p_project_id, 'Backlog',       0, '#6B5F88', '📋'),
    (p_project_id, 'Em Andamento',  1, '#FF6B1A', '🔄'),
    (p_project_id, 'Em Revisão',    2, '#F59E0B', '👀'),
    (p_project_id, 'Entregue',      3, '#22C55E', '✅');
END;
$$;

-- ============================================================
-- 10. VIEW: dashboard stats
-- ============================================================
CREATE OR REPLACE VIEW public.dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM public.leads   WHERE status = 'new')::INTEGER        AS leads_novos,
  (SELECT COUNT(*) FROM public.clients WHERE status = 'active')::INTEGER      AS clientes_ativos,
  (SELECT COUNT(*) FROM public.projects WHERE status = 'active')::INTEGER     AS projetos_ativos,
  (SELECT COUNT(*) FROM public.tasks   WHERE column_id IN (
    SELECT id FROM public.kanban_columns WHERE name = 'Em Andamento'
  ))::INTEGER AS tarefas_em_andamento;

COMMENT ON TABLE public.clients     IS 'Clientes oficiais da Agência Higher';
COMMENT ON TABLE public.projects    IS 'Projetos vinculados a clientes';
COMMENT ON TABLE public.tasks       IS 'Cards do kanban por projeto';
COMMENT ON TABLE public.deliverables IS 'Entregas visíveis ao cliente no portal';
