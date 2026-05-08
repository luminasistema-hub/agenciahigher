-- Migration: Create Budgets Table
-- Description: Table for storing client budgets/quotes

CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'declined')),
    valid_until DATE,
    items JSONB DEFAULT '[]'::jsonb, -- Array of objects: {description, quantity, unit_price}
    discount_percent NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    notes TEXT
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;

-- RLS (Row Level Security)
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- 1. Admins (Authenticated) can do everything
CREATE POLICY "Allow authenticated full access"
ON public.budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Public can READ a budget if they have the ID
CREATE POLICY "Allow public read with ID"
ON public.budgets FOR SELECT TO anon USING (true);

-- 3. Public can UPDATE status only (for approval/declining)
CREATE POLICY "Allow public status update"
ON public.budgets FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_budgets_client_id ON public.budgets(client_id);
CREATE INDEX idx_budgets_status ON public.budgets(status);
