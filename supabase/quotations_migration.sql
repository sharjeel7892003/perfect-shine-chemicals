-- ==============================================================================
-- PERFECT SHINE CHEMICALS — PRICE QUOTATIONS & PROPOSALS MODULE MIGRATION
-- Run this in your Supabase SQL Editor to enable cloud storage for Quotations.
-- ==============================================================================

-- 0. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    quotation_number TEXT UNIQUE NOT NULL,
    quotation_type TEXT NOT NULL DEFAULT 'private_label', -- 'private_label' | 'standard_unit_price'
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    email TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    validity_period TEXT NOT NULL DEFAULT 'Valid for 15 days',
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected' | 'expired'
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    moq TEXT,
    repeat_order_moq TEXT,
    sample_cost TEXT,
    sample_lead_time TEXT,
    delivery_charges TEXT,
    available_fragrances TEXT,
    formula_specifications TEXT,
    batch_mfg_expiry_info TEXT,
    terms_conditions TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. QUOTATION LINE ITEMS (RELATIONAL STORAGE)
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    quotation_id TEXT NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    size TEXT,
    product_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    bottle_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    cap_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    label_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    labour_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    carton_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    transport_cost NUMERIC(12, 4) DEFAULT 0.0000,
    total_cost_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    quoted_price_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    moq TEXT,
    notes TEXT,
    bottles_per_box NUMERIC(12, 4),
    unit_rate NUMERIC(12, 4),
    box_rate NUMERIC(12, 4),
    quantity_bottles NUMERIC(12, 4),
    quantity_boxes NUMERIC(12, 4),
    line_total NUMERIC(12, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES FOR FAST FILTERING & SEARCH
CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON public.quotations(date);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON public.quotation_items(quotation_id);

-- 4. GRANT TABLE PERMISSIONS
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.quotations TO authenticated;
GRANT ALL ON public.quotation_items TO authenticated;

-- Optional anon grants for local development / testing
GRANT ALL ON public.quotations TO anon;
GRANT ALL ON public.quotation_items TO anon;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotations_select_authenticated" ON public.quotations;
CREATE POLICY "quotations_select_authenticated" ON public.quotations
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "quotations_manage_authenticated" ON public.quotations;
CREATE POLICY "quotations_manage_authenticated" ON public.quotations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "quotation_items_select_authenticated" ON public.quotation_items;
CREATE POLICY "quotation_items_select_authenticated" ON public.quotation_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "quotation_items_manage_authenticated" ON public.quotation_items;
CREATE POLICY "quotation_items_manage_authenticated" ON public.quotation_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. REALTIME REPLICATION PUBLICATION
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotations, public.quotation_items;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
