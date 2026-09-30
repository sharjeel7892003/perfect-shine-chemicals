-- ==============================================================================
-- BOTTLING & PACKING MODULE MIGRATION
-- PERFECT SHINE CHEMICALS — POS & ERP SYSTEM
-- Tracks packaging recipes, bottling runs, bulk liquid deductions,
-- packaging material deductions, and true packed unit cost.
-- ==============================================================================

-- 0. Enable UUID Extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PACKING RUNS (BOTTLING BATCHES) TABLE
CREATE TABLE IF NOT EXISTS public.packing_runs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    run_number TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    pack_size_id TEXT NOT NULL,
    pack_size_name TEXT NOT NULL,
    quantity_packed NUMERIC(12, 4) NOT NULL,
    size_in_base_unit NUMERIC(12, 4) NOT NULL,
    bulk_liquid_consumed NUMERIC(12, 4) NOT NULL,
    bulk_unit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    bulk_total_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    packaging_materials_consumed JSONB NOT NULL DEFAULT '[]'::jsonb,
    packaging_total_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    total_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    true_cost_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operator_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ADD PACKED STOCK & TRUE COST COLUMNS TO PACK_SIZES TABLE IF EXISTS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pack_sizes') THEN
    ALTER TABLE public.pack_sizes ADD COLUMN IF NOT EXISTS packed_stock NUMERIC(12, 4) NOT NULL DEFAULT 0.0000;
    ALTER TABLE public.pack_sizes ADD COLUMN IF NOT EXISTS true_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000;
    ALTER TABLE public.pack_sizes ADD COLUMN IF NOT EXISTS packaging_items JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_packing_runs_product_id ON public.packing_runs(product_id);
CREATE INDEX IF NOT EXISTS idx_packing_runs_pack_size_id ON public.packing_runs(pack_size_id);
CREATE INDEX IF NOT EXISTS idx_packing_runs_date ON public.packing_runs(date);

-- 4. GRANT TABLE PRIVILEGES
GRANT ALL ON public.packing_runs TO authenticated;
GRANT ALL ON public.packing_runs TO anon;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.packing_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users read on packing_runs" ON public.packing_runs;
CREATE POLICY "Allow all users read on packing_runs"
ON public.packing_runs FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow all users manage on packing_runs" ON public.packing_runs;
CREATE POLICY "Allow all users manage on packing_runs"
ON public.packing_runs FOR ALL
USING (true)
WITH CHECK (true);
