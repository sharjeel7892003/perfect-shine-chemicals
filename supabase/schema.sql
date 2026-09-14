-- ==============================================================================
-- PERFECT SHINE CHEMICALS — FACTORY MANAGEMENT SYSTEM (POS & ERP)
-- COMPLETE SUPABASE POSTGRESQL SCHEMA WITH CLOUD SYNC & REALTIME
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES & USER ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'sales_staff',
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deactivated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PRODUCTS TABLE (SINGLE BASE UNIT TRACKING + PACK SIZES JSONB)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'Chemicals',
    unit TEXT NOT NULL DEFAULT 'liter',
    base_unit TEXT NOT NULL DEFAULT 'liter',
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 10.00,
    description TEXT,
    pack_sizes JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure pack_sizes column exists if products was created previously
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pack_sizes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 3. RAW MATERIALS ENTITY TABLE
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Surfactants',
    unit TEXT NOT NULL DEFAULT 'kg',
    current_stock NUMERIC(12, 4) NOT NULL DEFAULT 0.00,
    reorder_level NUMERIC(12, 4) NOT NULL DEFAULT 50.00,
    cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 4. PRODUCT FORMULATIONS (BILL OF MATERIALS / RECIPES)
CREATE TABLE IF NOT EXISTS public.product_formulations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    base_unit TEXT NOT NULL DEFAULT 'liter',
    yield_quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.00,
    items JSONB DEFAULT '[]'::jsonb,
    instructions TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PRODUCTION BATCHES TABLE
CREATE TABLE IF NOT EXISTS public.production_batches (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    batch_number TEXT UNIQUE NOT NULL,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity_produced NUMERIC(12, 4) NOT NULL,
    base_unit TEXT NOT NULL DEFAULT 'liter',
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supervisor_name TEXT,
    total_batch_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost_per_base_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    consumed_materials JSONB DEFAULT '[]'::jsonb,
    raw_materials_consumed JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS raw_materials_consumed JSONB DEFAULT '[]'::jsonb;

-- 6. RAW MATERIAL MOVEMENTS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.raw_material_movements (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    raw_material_id TEXT NOT NULL,
    raw_material_name TEXT NOT NULL,
    movement_type TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL,
    previous_stock NUMERIC(12, 4),
    new_stock NUMERIC(12, 4),
    reference_id TEXT,
    notes TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_name TEXT
);

-- 7. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT DEFAULT 'Lahore',
    customer_type TEXT NOT NULL DEFAULT 'retail',
    credit_limit NUMERIC(12, 2) DEFAULT 50000.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 8. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT DEFAULT 'Lahore',
    raw_material_type TEXT,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 9. SALES TABLE (INVOICES)
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    items JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    payment_method TEXT DEFAULT 'cash',
    salesperson_id TEXT,
    salesperson_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS public.purchases (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    supplier_id TEXT,
    supplier_name TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    items JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. FINISHED GOODS STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    product_id TEXT NOT NULL,
    product_name TEXT,
    movement_type TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL,
    previous_stock NUMERIC(12, 4),
    new_stock NUMERIC(12, 4),
    reference_id TEXT,
    notes TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_name TEXT
);

-- 12. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    related_to TEXT NOT NULL,
    reference_id TEXT,
    reference_no TEXT,
    customer_id TEXT,
    customer_name TEXT,
    supplier_id TEXT,
    supplier_name TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    transaction_ref TEXT,
    notes TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. DELETION AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.deletion_audit_logs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_title TEXT NOT NULL,
    action_type TEXT NOT NULL,
    impact_summary TEXT,
    performed_by TEXT,
    performed_by_role TEXT,
    reversal_details JSONB DEFAULT '{}'::jsonb,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.deletion_audit_logs ADD COLUMN IF NOT EXISTS reversal_details JSONB DEFAULT '{}'::jsonb;

-- ==============================================================================
-- PERMISSIONS & ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Convert ID column types from UUID to TEXT if tables were originally created with UUID
DO $$ 
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id TYPE TEXT USING id::text', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Disable RLS on all POS operational tables to grant full access for POS operations
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_formulations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_audit_logs DISABLE ROW LEVEL SECURITY;

-- If RLS is enabled by default or re-enabled by project policies, grant full access
DO $$ 
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "Allow public full access" ON public.%I', tbl);
      EXECUTE format('CREATE POLICY "Allow public full access" ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Enable Realtime publication for multi-device sync
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.products,
      public.raw_materials,
      public.product_formulations,
      public.production_batches,
      public.raw_material_movements,
      public.customers,
      public.suppliers,
      public.sales,
      public.purchases,
      public.stock_movements,
      public.payments,
      public.deletion_audit_logs,
      public.profiles;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
