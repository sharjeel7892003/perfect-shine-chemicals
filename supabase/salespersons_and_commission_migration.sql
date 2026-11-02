-- ==============================================================================
-- PERFECT SHINE CHEMICALS — SALESPERSONS & SALES COMMISSION MIGRATION
-- ==============================================================================
-- Idempotent, non-destructive migration to create the salespersons, 
-- monthly_commission_closures, and commission_payments tables with UUID primary keys,
-- seed the 3 official salespeople (Sharjeel, Aqeel, Ilyas at 10%), link the foreign key
-- on sales.salesperson_id, and establish authenticated RLS policies.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SALESPERSONS TABLE
CREATE TABLE IF NOT EXISTS public.salespersons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INSERT 3 REAL SALESPERSONS (Sharjeel, Aqeel, Ilyas @ 10%)
INSERT INTO public.salespersons (id, name, commission_rate, is_active)
SELECT gen_random_uuid(), 'Sharjeel', 10.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.salespersons WHERE LOWER(TRIM(name)) = 'sharjeel');

INSERT INTO public.salespersons (id, name, commission_rate, is_active)
SELECT gen_random_uuid(), 'Aqeel', 10.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.salespersons WHERE LOWER(TRIM(name)) = 'aqeel');

INSERT INTO public.salespersons (id, name, commission_rate, is_active)
SELECT gen_random_uuid(), 'Ilyas', 10.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.salespersons WHERE LOWER(TRIM(name)) = 'ilyas');

-- 3. MONTHLY COMMISSION CLOSURES TABLE
CREATE TABLE IF NOT EXISTS public.monthly_commission_closures (
    month TEXT PRIMARY KEY, -- Format 'YYYY-MM'
    is_closed BOOLEAN NOT NULL DEFAULT true,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_by UUID,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salesperson_id UUID NOT NULL REFERENCES public.salespersons(id) ON DELETE RESTRICT,
    salesperson_name TEXT NOT NULL,
    month TEXT NOT NULL, -- Format 'YYYY-MM'
    amount NUMERIC(14, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_date DATE NOT NULL,
    payment_id TEXT, -- Associated cashbook payment reference
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ENSURE COLUMN AND FOREIGN KEY ON public.sales
-- Drop legacy foreign key constraint pointing to profiles table
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_salesperson_id_fkey;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS fk_sales_salesperson;

ALTER TABLE public.sales 
ADD CONSTRAINT fk_sales_salesperson 
FOREIGN KEY (salesperson_id) 
REFERENCES public.salespersons(id) 
ON DELETE SET NULL;

-- 6. ENABLE ROW LEVEL SECURITY & POLICIES
ALTER TABLE public.salespersons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_commission_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.salespersons TO authenticated;
GRANT ALL ON public.monthly_commission_closures TO authenticated;
GRANT ALL ON public.commission_payments TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'salespersons' AND policyname = 'salespersons_auth_all') THEN
    CREATE POLICY salespersons_auth_all ON public.salespersons FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'monthly_commission_closures' AND policyname = 'closures_auth_all') THEN
    CREATE POLICY closures_auth_all ON public.monthly_commission_closures FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commission_payments' AND policyname = 'comm_payments_auth_all') THEN
    CREATE POLICY comm_payments_auth_all ON public.commission_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
