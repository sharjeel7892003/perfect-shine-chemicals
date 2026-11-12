-- ============================================================================
-- PERFECT SHINE CHEMICALS ERP - NON-PRODUCT / SERVICE CHARGES ON SALES INVOICES
-- Non-destructive migration for invoice_charges, sales columns, app_settings,
-- and Row Level Security (RLS) policies.
-- ============================================================================

-- 1. Create dedicated invoice_charges table for non-product service charges
CREATE TABLE IF NOT EXISTS public.invoice_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'Labour',
  description TEXT NOT NULL DEFAULT '',
  calc_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (calc_mode IN ('fixed', 'qty_rate')),
  quantity NUMERIC(14,4),
  rate NUMERIC(14,4),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_auto_private_label BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_charges_sale_id ON public.invoice_charges(sale_id);

-- 2. Add non-destructive columns to public.sales for fast querying and JSONB backup
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS charges JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS service_charges_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_subtotal NUMERIC(14,2);

-- 3. Ensure public.app_settings exists for Admin-controlled charge types and commission toggle
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Seed default charge types (Labour, Transportation/Delivery, Packing, Other)
INSERT INTO public.app_settings (key, value)
VALUES (
  'invoice_charge_types',
  '{"types": ["Labour", "Transportation/Delivery", "Packing", "Other"]}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Seed default commission setting (exclude service charges from commission base by default)
INSERT INTO public.app_settings (key, value)
VALUES (
  'commission_settings',
  '{"include_service_charges": false}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 4. Enable Row Level Security (RLS) on invoice_charges and app_settings
ALTER TABLE public.invoice_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check current user's role from public.profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- RLS Policies for public.invoice_charges
DROP POLICY IF EXISTS "invoice_charges_select_policy" ON public.invoice_charges;
DROP POLICY IF EXISTS "invoice_charges_insert_policy" ON public.invoice_charges;
DROP POLICY IF EXISTS "invoice_charges_update_policy" ON public.invoice_charges;
DROP POLICY IF EXISTS "invoice_charges_delete_policy" ON public.invoice_charges;

-- Authenticated staff can view invoice charges
CREATE POLICY "invoice_charges_select_policy"
ON public.invoice_charges
FOR SELECT
TO authenticated
USING (TRUE);

-- Owner, Sales Staff, and Accounts Staff can insert/update/delete invoice charges
CREATE POLICY "invoice_charges_insert_policy"
ON public.invoice_charges
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_role() IN ('owner', 'sales_staff', 'accounts_staff')
);

CREATE POLICY "invoice_charges_update_policy"
ON public.invoice_charges
FOR UPDATE
TO authenticated
USING (
  public.current_user_role() IN ('owner', 'sales_staff', 'accounts_staff')
)
WITH CHECK (
  public.current_user_role() IN ('owner', 'sales_staff', 'accounts_staff')
);

CREATE POLICY "invoice_charges_delete_policy"
ON public.invoice_charges
FOR DELETE
TO authenticated
USING (
  public.current_user_role() IN ('owner', 'sales_staff', 'accounts_staff')
);

-- RLS Policies for public.app_settings
DROP POLICY IF EXISTS "app_settings_select_policy" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_write_policy" ON public.app_settings;

CREATE POLICY "app_settings_select_policy"
ON public.app_settings
FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "app_settings_write_policy"
ON public.app_settings
FOR ALL
TO authenticated
USING (public.current_user_role() = 'owner')
WITH CHECK (public.current_user_role() = 'owner');
