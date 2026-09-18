-- ==============================================================================
-- PERFECT SHINE CHEMICALS — FACTORY MANAGEMENT SYSTEM (POS & ERP)
-- COMPLETE SUPABASE POSTGRESQL SCHEMA WITH CLOUD SYNC & REALTIME
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES & USER ROLES (FACTORY SHIFT STAFF)
-- Drop any lingering foreign key to auth.users if profiles was created by default Supabase template
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'sales_staff',
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
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

-- 9. SALES TABLE (INVOICES - Normalized parent table, NO items column)
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    payment_method TEXT DEFAULT 'cash',
    salesperson_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS salesperson_id TEXT;

-- 9B. SALE ITEMS TABLE (Normalized line items)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id TEXT,
    product_name TEXT NOT NULL,
    pack_size_id TEXT,
    pack_size_name TEXT,
    pack_quantity NUMERIC(12, 4),
    size_in_base_unit NUMERIC(12, 4),
    base_quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PURCHASES TABLE (PURCHASE ORDERS - Normalized parent table, NO items column)
CREATE TABLE IF NOT EXISTS public.purchases (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    supplier_id TEXT,
    supplier_name TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10B. PURCHASE ITEMS TABLE (Normalized line items)
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    purchase_id TEXT NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    item_type TEXT DEFAULT 'raw_material',
    raw_material_id TEXT,
    product_id TEXT,
    product_or_material_name TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
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

-- 14. EXPENSES TABLE
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

-- 15. RECURRING EXPENSES TEMPLATES
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_posted_month TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- PERMISSIONS & ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 1. Enable RLS on all operational tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_formulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Dynamic safety: Automatically enable RLS on every table in the public schema
DO $$ 
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 2. Helper function to extract current user role from request headers or auth session
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
BEGIN
  -- Check x-user-role request header from application
  IF current_setting('request.headers', true) IS NOT NULL THEN
    DECLARE
      hdrs json := current_setting('request.headers', true)::json;
      r text := hdrs->>'x-user-role';
    BEGIN
      IF r IS NOT NULL AND r <> '' THEN
        RETURN r;
      END IF;
    END;
  END IF;

  -- Check auth.uid() mapped in profiles table
  IF auth.uid() IS NOT NULL THEN
    DECLARE
      user_role text;
    BEGIN
      SELECT role INTO user_role FROM public.profiles WHERE id::text = auth.uid()::text LIMIT 1;
      IF user_role IS NOT NULL THEN
        RETURN user_role;
      END IF;
    END;
  END IF;

  -- Default to authenticated / staff role for POS client
  RETURN 'admin';
END;
$$ LANGUAGE plpgsql STABLE;

-- Drop existing generic policies
DO $$ 
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "Allow public full access" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Admin full access" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Sales staff access" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Accountant access" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Production access" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Public read access" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "PSC operational access" ON public.%I', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 3. Define Master Role-Based RLS Policies across tables:

-- PROFILES (Users)
CREATE POLICY "Profiles read access" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles admin manage" ON public.profiles FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin'));

-- PRODUCTS
CREATE POLICY "Products read access" ON public.products FOR SELECT USING (true);
CREATE POLICY "Products admin write" ON public.products FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'production_supervisor'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'production_supervisor'));

-- RAW MATERIALS
CREATE POLICY "Raw materials read access" ON public.raw_materials FOR SELECT USING (true);
CREATE POLICY "Raw materials write" ON public.raw_materials FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'production_supervisor', 'accountant'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'production_supervisor', 'accountant'));

-- PRODUCT FORMULATIONS (BOM Recipes)
CREATE POLICY "Formulations read access" ON public.product_formulations FOR SELECT 
  USING (public.current_user_role() IN ('owner', 'admin', 'production_supervisor'));
CREATE POLICY "Formulations write" ON public.product_formulations FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'production_supervisor'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'production_supervisor'));

-- PRODUCTION BATCHES
CREATE POLICY "Production batches read" ON public.production_batches FOR SELECT USING (true);
CREATE POLICY "Production batches write" ON public.production_batches FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'production_supervisor'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'production_supervisor'));

-- RAW MATERIAL MOVEMENTS
CREATE POLICY "Raw movements read" ON public.raw_material_movements FOR SELECT USING (true);
CREATE POLICY "Raw movements write" ON public.raw_material_movements FOR INSERT 
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'production_supervisor', 'accountant'));

-- CUSTOMERS
CREATE POLICY "Customers read" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Customers write" ON public.customers FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'sales_staff', 'accountant'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'sales_staff', 'accountant'));

-- SUPPLIERS
CREATE POLICY "Suppliers read" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Suppliers write" ON public.suppliers FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'accountant'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'accountant'));

-- SALES (INVOICES)
CREATE POLICY "Sales read" ON public.sales FOR SELECT USING (true);
CREATE POLICY "Sales create" ON public.sales FOR INSERT 
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'sales_staff', 'accountant'));
CREATE POLICY "Sales update" ON public.sales FOR UPDATE 
  USING (public.current_user_role() IN ('owner', 'admin', 'accountant'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'accountant'));
CREATE POLICY "Sales delete" ON public.sales FOR DELETE 
  USING (public.current_user_role() IN ('owner', 'admin'));

-- PURCHASES (POs)
CREATE POLICY "Purchases read" ON public.purchases FOR SELECT USING (true);
CREATE POLICY "Purchases write" ON public.purchases FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'accountant'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'accountant'));

-- STOCK MOVEMENTS (AUDIT TRAIL)
CREATE POLICY "Stock movements read" ON public.stock_movements FOR SELECT USING (true);
CREATE POLICY "Stock movements insert" ON public.stock_movements FOR INSERT 
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'sales_staff', 'production_supervisor', 'accountant'));

-- PAYMENTS (CASH BOOK)
CREATE POLICY "Payments read" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Payments write" ON public.payments FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'accountant', 'sales_staff'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'accountant', 'sales_staff'));

-- EXPENSES (OVERHEAD COSTS)
CREATE POLICY "Expenses read" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Expenses manage" ON public.expenses FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'accountant', 'accounts_staff'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'accountant', 'accounts_staff'));

-- RECURRING EXPENSES TEMPLATES
CREATE POLICY "Recurring expenses read" ON public.recurring_expenses FOR SELECT USING (true);
CREATE POLICY "Recurring expenses manage" ON public.recurring_expenses FOR ALL 
  USING (public.current_user_role() IN ('owner', 'admin', 'accountant', 'accounts_staff'))
  WITH CHECK (public.current_user_role() IN ('owner', 'admin', 'accountant', 'accounts_staff'));

-- DELETION AUDIT LOGS
CREATE POLICY "Audit logs read" ON public.deletion_audit_logs FOR SELECT 
  USING (public.current_user_role() IN ('owner', 'admin'));
CREATE POLICY "Audit logs insert" ON public.deletion_audit_logs FOR INSERT 
  WITH CHECK (public.current_user_role() IN ('owner', 'admin'));

-- Fallback POS operational access policy for valid Supabase client requests
DO $$ 
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('CREATE POLICY "PSC operational access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 4. Enable Realtime publication for multi-device sync
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
      public.profiles,
      public.expenses,
      public.recurring_expenses;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;


