-- Corrige as colunas que podem estar faltando devido ao IF NOT EXISTS na criação da tabela
ALTER TABLE public.financial_settings ADD COLUMN IF NOT EXISTS asaas_api_key TEXT;
ALTER TABLE public.financial_settings ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT;
ALTER TABLE public.financial_settings ADD COLUMN IF NOT EXISTS asaas_webhook_token TEXT;
ALTER TABLE public.financial_settings ADD COLUMN IF NOT EXISTS asaas_sandbox BOOLEAN DEFAULT false;
