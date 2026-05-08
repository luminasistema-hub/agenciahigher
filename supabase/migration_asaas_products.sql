-- Atualização na tabela de clients para Asaas
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- Adicionar permissões RLS para produtos
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_products" ON public.products;
CREATE POLICY "admin_all_products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert sample products
INSERT INTO public.products (name, default_price, description)
VALUES 
  ('Landing Page Starter', 1500.00, 'Criação de site onepage responsivo clássico com SEO e WhatsApp integrado'),
  ('Site Institucional Completo', 3500.00, 'Site de até 5 páginas, blog e sistema CMS para edição'),
  ('Manutenção e Hosting Mensal', 199.90, 'Hospedagem, atualizações de segurança e suporte diário'),
  ('E-commerce Básico', 4500.00, 'Loja virtual com até 50 produtos cadastrados, gateway de pagamento e correios'),
  ('Consultoria em IA', 500.00, 'Consultoria de 2 horas para implantar IA no negócio'),
  ('Gestão de Tráfego', 1200.00, 'Gestão de campanhas de anúncios (Mensal)')
ON CONFLICT DO NOTHING;
