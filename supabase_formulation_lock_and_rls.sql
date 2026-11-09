-- ============================================================================
-- PERFECT SHINE CHEMICALS ERP - FORMULATION LOCK, VERSIONING & CONFIDENTIAL RLS
-- Non-destructive migration for product_formulations, formulation_items,
-- production_batches, and app_settings.
-- ============================================================================

-- 1. Add version and lock columns to product_formulations (non-destructive)
ALTER TABLE public.product_formulations
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS parent_formulation_id UUID REFERENCES public.product_formulations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_historical_version BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Drop any old unique constraint on product_id if one exists so multiple versions (v1, v2, v3) can coexist per product
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.product_formulations'::regclass
      AND contype = 'u'
  ) LOOP
    EXECUTE 'ALTER TABLE public.product_formulations DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- Ensure all existing formulations are at least version 1
UPDATE public.product_formulations
SET version = COALESCE(version, 1)
WHERE version IS NULL OR version < 1;

-- 2. Add formulation_id and formulation_version to production_batches (non-destructive)
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS formulation_id UUID REFERENCES public.product_formulations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS formulation_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS formulation_batch_size NUMERIC(14,4);

-- Backfill existing production batches with version 1 (preserving saved data)
UPDATE public.production_batches
SET formulation_version = COALESCE(formulation_version, 1)
WHERE formulation_version IS NULL;

-- 3. Create app_settings table in Supabase for Admin-controlled settings (e.g. production staff batch sheet access)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO public.app_settings (key, value)
VALUES ('formulation_access', '{"allow_production_staff_batch_sheets": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Database Trigger to block direct updates to locked formulations (except unlocking/archiving to history)
CREATE OR REPLACE FUNCTION public.prevent_locked_formulation_direct_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If the formulation was already locked and remains locked, only allow marking it as historical/archived
  -- when a new version is unlocked from it. Block any changes to yield_quantity or base_unit.
  IF OLD.is_locked = TRUE AND NEW.is_locked = TRUE THEN
    IF NEW.yield_quantity IS DISTINCT FROM OLD.yield_quantity
       OR NEW.base_unit IS DISTINCT FROM OLD.base_unit
       OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      RAISE EXCEPTION 'Locked formulation (v%) cannot be edited directly. Unlock to create a new version.', OLD.version;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_formulation_edit ON public.product_formulations;
CREATE TRIGGER trg_prevent_locked_formulation_edit
BEFORE UPDATE ON public.product_formulations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_formulation_direct_edit();

-- 5. Enable Row Level Security (RLS) on confidential formulation tables
ALTER TABLE public.product_formulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulation_items ENABLE ROW LEVEL SECURITY;
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

-- Helper function to check whether Admin enabled production staff batch sheet access
CREATE OR REPLACE FUNCTION public.can_staff_view_batch_sheets()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT (value->>'allow_production_staff_batch_sheets')::boolean FROM public.app_settings WHERE key = 'formulation_access'),
    EXISTS (
      SELECT 1 FROM public.product_formulations
      WHERE instructions LIKE '%"allow_staff_batch_sheets":true%'
    ),
    FALSE
  );
$$;

-- Drop old permissive policies on product_formulations and formulation_items if any
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.product_formulations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.product_formulations;
DROP POLICY IF EXISTS "formulations_select_policy" ON public.product_formulations;
DROP POLICY IF EXISTS "formulations_write_policy" ON public.product_formulations;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.formulation_items;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.formulation_items;
DROP POLICY IF EXISTS "formulation_items_select_policy" ON public.formulation_items;
DROP POLICY IF EXISTS "formulation_items_write_policy" ON public.formulation_items;

-- Confidential SELECT Policy:
-- - 'owner' (Admin) can always view all formulations.
-- - 'general_staff' (Production Staff) can view ONLY when Admin has enabled batch sheet access.
-- - 'sales_staff' and 'accounts_staff' can NEVER view formulations.
CREATE POLICY "formulations_select_policy"
ON public.product_formulations
FOR SELECT
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'general_staff'
    AND public.can_staff_view_batch_sheets() = TRUE
  )
);

-- Confidential WRITE Policy (INSERT / UPDATE / DELETE):
-- - Strictly 'owner' (Admin) only.
CREATE POLICY "formulations_write_policy"
ON public.product_formulations
FOR ALL
TO authenticated
USING (public.current_user_role() = 'owner')
WITH CHECK (public.current_user_role() = 'owner');

-- Matching RLS Policies for formulation_items:
CREATE POLICY "formulation_items_select_policy"
ON public.formulation_items
FOR SELECT
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'general_staff'
    AND public.can_staff_view_batch_sheets() = TRUE
  )
);

CREATE POLICY "formulation_items_write_policy"
ON public.formulation_items
FOR ALL
TO authenticated
USING (public.current_user_role() = 'owner')
WITH CHECK (public.current_user_role() = 'owner');

-- RLS Policies for app_settings:
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

