-- MIGRATION: WEBHOOK LOGS AND ENHANCEMENTS

-- 1. Create Webhook Logs table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    source TEXT, -- 'asaas', etc.
    event_type TEXT,
    payload JSONB
);

-- Enable RLS for webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admins) can view logs
CREATE POLICY "Admins can view logs" ON public.webhook_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Ensure Clients have asaas_customer_id
-- (Should already exist based on functions code, but good to ensure)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='asaas_customer_id') THEN
        ALTER TABLE public.clients ADD COLUMN asaas_customer_id TEXT;
    END IF;
END $$;

-- 3. Ensure Invoices have asaas_invoice_id and asaas_payment_url
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='asaas_invoice_id') THEN
        ALTER TABLE public.invoices ADD COLUMN asaas_invoice_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='asaas_payment_url') THEN
        ALTER TABLE public.invoices ADD COLUMN asaas_payment_url TEXT;
    END IF;
END $$;

-- 4. Trigger to update invoice total paid when a payment is inserted
CREATE OR REPLACE FUNCTION public.handle_payment_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.invoices
    SET amount_paid = (
        SELECT COALESCE(SUM(amount), 0)
        FROM public.payments
        WHERE invoice_id = NEW.invoice_id
    )
    WHERE id = NEW.invoice_id;

    -- If total is reached, mark as paid
    UPDATE public.invoices
    SET status = 'paid'
    WHERE id = NEW.invoice_id 
    AND amount_paid >= total;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_insert ON public.payments;
CREATE TRIGGER on_payment_insert
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.handle_payment_insert();
