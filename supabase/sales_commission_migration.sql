-- ==============================================================================
-- PERFECT SHINE CHEMICALS — SALES COMMISSION SYSTEM MIGRATION
-- ==============================================================================
-- 1. Table: salespersons (Admin managed, independent of login users)
-- 2. Table: monthly_commission_closures (Month-end locked snapshots)
-- 3. Table: commission_payments (Payout tracking linked to Cash Book)
-- 4. Column: salesperson_id on public.sales (verified)
-- 5. Strict RLS Policies: Admin full access, Sales Staff blocked from commissions
-- ==============================================================================

-- 1. SALESPERSONS TABLE
CREATE TABLE IF NOT EXISTS public.salespersons (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial salespersons if not already present
INSERT INTO public.salespersons (id, name, commission_rate, is_active)
VALUES 
    ('sp_sharjeel_initial', 'Sharjeel', 10.00, true),
    ('sp_aqeel_initial', 'Aqeel', 10.00, true),
    ('sp_ilyas_initial', 'Ilyas', 10.00, true)
ON CONFLICT (id) DO NOTHING;

-- 2. ENSURE salesperson_id COLUMN ON SALES
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS salesperson_id TEXT;

-- 3. MONTHLY COMMISSION CLOSURES TABLE
CREATE TABLE IF NOT EXISTS public.monthly_commission_closures (
    month TEXT PRIMARY KEY, -- Format 'YYYY-MM'
    is_closed BOOLEAN NOT NULL DEFAULT true,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_by TEXT,
    closed_by_name TEXT,
    total_gross_profit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    coverage_factor NUMERIC(8, 6) NOT NULL DEFAULT 0.000000,
    total_commission NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    owner_remaining_profit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    include_depreciation BOOLEAN NOT NULL DEFAULT false,
    snapshots JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. COMMISSION PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.commission_payments (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    salesperson_id TEXT NOT NULL REFERENCES public.salespersons(id) ON DELETE RESTRICT,
    salesperson_name TEXT NOT NULL,
    month TEXT NOT NULL, -- Format 'YYYY-MM'
    amount NUMERIC(14, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_date DATE NOT NULL,
    payment_id TEXT, -- Associated cashbook payment record
    notes TEXT,
    recorded_by TEXT,
    recorded_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ENABLE AND FORCE RLS
ALTER TABLE public.salespersons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salespersons FORCE ROW LEVEL SECURITY;

ALTER TABLE public.monthly_commission_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_commission_closures FORCE ROW LEVEL SECURITY;

ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments FORCE ROW LEVEL SECURITY;

-- 6. RLS POLICIES FOR SALESPERSONS
-- Authenticated users (including sales staff) can select salespersons to assign on sales
DROP POLICY IF EXISTS "salespersons_select_auth" ON public.salespersons;
CREATE POLICY "salespersons_select_auth" ON public.salespersons
    FOR SELECT TO authenticated USING (true);

-- Only Admin can insert, update, or delete salespersons
DROP POLICY IF EXISTS "salespersons_admin_manage" ON public.salespersons;
CREATE POLICY "salespersons_admin_manage" ON public.salespersons
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. RLS POLICIES FOR MONTHLY COMMISSION CLOSURES (Admin ONLY)
DROP POLICY IF EXISTS "closures_admin_all" ON public.monthly_commission_closures;
CREATE POLICY "closures_admin_all" ON public.monthly_commission_closures
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8. RLS POLICIES FOR COMMISSION PAYMENTS (Admin ONLY)
DROP POLICY IF EXISTS "commission_payments_admin_all" ON public.commission_payments;
CREATE POLICY "commission_payments_admin_all" ON public.commission_payments
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
