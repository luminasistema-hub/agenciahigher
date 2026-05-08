-- MIGRATION: NOTIFICATIONS SYSTEM

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'payment'
    is_read BOOLEAN DEFAULT false,
    link TEXT -- Optional link to invoice or project
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own notifications" ON public.notifications
    FOR SELECT USING (client_id = (SELECT id FROM public.clients WHERE id = notifications.client_id)); -- Simplification for portal context

CREATE POLICY "Admins can manage notifications" ON public.notifications
    FOR ALL USING (auth.role() = 'authenticated');

-- Trigger to notify on new invoice (optional enhancement)
CREATE OR REPLACE FUNCTION public.notify_new_invoice()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (client_id, title, message, type, link)
    VALUES (
        NEW.client_id, 
        '🧾 Nova Fatura Disponível', 
        'Uma nova fatura no valor de ' || NEW.total || ' foi gerada.',
        'payment',
        '/client-portal.html?view=invoices'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_invoice_notify ON public.invoices;
CREATE TRIGGER on_new_invoice_notify
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.notify_new_invoice();
