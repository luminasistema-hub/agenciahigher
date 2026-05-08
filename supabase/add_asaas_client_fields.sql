-- Adiciona as colunas necessárias para emissão de cobranças perfeitas no Asaas
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS document TEXT; -- CPF ou CNPJ
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Adiciona ID de cliente do asaas para evitar duplicidade de cadastros lá dentro
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
