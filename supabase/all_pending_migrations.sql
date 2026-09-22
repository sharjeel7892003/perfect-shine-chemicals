-- ==============================================================================
-- PERFECT SHINE CHEMICALS — ALL PENDING DATABASE MIGRATIONS (ONE-CLICK SCRIPT)
-- Run this in your Supabase SQL Editor to bring your database 100% up to date.
-- ==============================================================================

-- 0. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. EXPENSES & RECURRING EXPENSES MODULE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    recorded_by TEXT,
    recorded_by_name TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_posted_month TEXT, -- e.g. '2026-09'
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. CASH BOOK & PAYMENTS CONSTRAINT UPDATE
-- ==============================================================================
-- Allow 'expense' in related_to so operating expenses automatically appear in Cash Book
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_related_to_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_related_to_check 
  CHECK (related_to IN ('sale', 'purchase', 'customer_balance', 'supplier_balance', 'expense'));

-- ==============================================================================
-- 3. PACKAGING UNITS & SELLABLE RAW MATERIALS RESALE
-- ==============================================================================
-- Allow 'pcs' unit for bottles, caps, packaging raw materials
ALTER TABLE public.raw_materials DROP CONSTRAINT IF EXISTS raw_materials_unit_check;
ALTER TABLE public.raw_materials ADD CONSTRAINT raw_materials_unit_check 
  CHECK (unit IN ('kg', 'liter', 'pcs'));

ALTER TABLE public.formulation_items DROP CONSTRAINT IF EXISTS formulation_items_unit_check;
ALTER TABLE public.formulation_items ADD CONSTRAINT formulation_items_unit_check 
  CHECK (unit IN ('kg', 'liter', 'pcs'));

-- Ensure formulations table supports safe archiving
ALTER TABLE public.product_formulations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Add sellable raw material resale fields
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2) DEFAULT 0.00;

-- Support selling raw materials in sales invoices
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'finished_product';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS raw_material_id TEXT;
ALTER TABLE public.sale_items ALTER COLUMN product_id DROP NOT NULL;

-- Support resale stock movements audit trail
ALTER TABLE public.raw_material_movements DROP CONSTRAINT IF EXISTS raw_material_movements_movement_type_check;
ALTER TABLE public.raw_material_movements ADD CONSTRAINT raw_material_movements_movement_type_check 
  CHECK (movement_type IN ('purchase_in', 'production_out', 'adjustment', 'return', 'sale_out', 'resale_out'));

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Expenses read" ON public.expenses;
CREATE POLICY "Expenses read" ON public.expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Expenses manage" ON public.expenses;
CREATE POLICY "Expenses manage" ON public.expenses FOR ALL 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Recurring expenses read" ON public.recurring_expenses;
CREATE POLICY "Recurring expenses read" ON public.recurring_expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Recurring expenses manage" ON public.recurring_expenses;
CREATE POLICY "Recurring expenses manage" ON public.recurring_expenses FOR ALL 
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 5. REALTIME MULTI-DEVICE PUBLICATION
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses, public.recurring_expenses;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
