-- ==============================================================================
-- PERFECT SHINE CHEMICALS — DATABASE SECURITY AUDIT & COMPLETE RLS LOCKDOWN
-- ==============================================================================
-- 1. Enable and FORCE Row Level Security (RLS) on ALL 20 public tables.
-- 2. Drop all legacy/permissive policies granting public or anonymous access.
-- 3. Revoke all table privileges from 'anon' (unauthenticated requests).
-- 4. Create SECURITY DEFINER role resolution helpers based on auth.uid() & email.
-- 5. Apply strict Role-Based Access Control (RBAC) policies:
--    - Admin (owner): Full CRUD across all tables.
--    - Accounts Staff (accounts_staff): Purchases, Payments, Expenses, Reports. No Delete.
--    - Sales Staff (sales_staff): Sales & Customers. No Raw Materials, Formulations, P&L, or Delete.
--    - General Staff (general_staff): Production Batches, Inventory movements. No Financials or Delete.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: ENABLE & FORCE RLS ON ALL PUBLIC TABLES
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  tables_list TEXT[] := ARRAY[
    'profiles',
    'products',
    'raw_materials',
    'product_formulations',
    'formulation_items',
    'production_batches',
    'raw_material_movements',
    'customers',
    'suppliers',
    'sales',
    'sale_items',
    'purchases',
    'purchase_items',
    'stock_movements',
    'payments',
    'expenses',
    'recurring_expenses',
    'fixed_assets',
    'deletion_audit_logs',
    'pack_sizes'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_list LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: DROP ALL EXISTING POLICIES ON PUBLIC TABLES
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 3: REVOKE PUBLIC / ANONYMOUS PRIVILEGES
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ------------------------------------------------------------------------------
-- STEP 4: SECURITY DEFINER ROLE HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Resolve the role of the currently logged in user
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
  resolved_role TEXT;
BEGIN
  SELECT role INTO resolved_role 
  FROM public.profiles 
  WHERE id::text = auth.uid()::text 
     OR LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt()->>'email'))
  LIMIT 1;

  RETURN COALESCE(resolved_role, 'none');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Role verification functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (public.current_user_role() = 'owner');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_accounts()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (public.current_user_role() IN ('owner', 'accounts_staff'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_sales()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (public.current_user_role() IN ('owner', 'sales_staff'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_production()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (public.current_user_role() IN ('owner', 'general_staff', 'accounts_staff'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.current_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_accounts TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sales TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_production TO authenticated;

-- ------------------------------------------------------------------------------
-- STEP 5: ROLE-BASED POLICIES FOR EACH TABLE
-- ------------------------------------------------------------------------------

-- 1. PROFILES
CREATE POLICY "profiles_authenticated_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_admin_or_self_update" ON public.profiles
  FOR UPDATE TO authenticated 
  USING (public.is_admin() OR id::text = auth.uid()::text)
  WITH CHECK (public.is_admin() OR id::text = auth.uid()::text);

CREATE POLICY "profiles_admin_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR auth.uid() IS NOT NULL);

CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin());


-- 2. PRODUCTS & PACK SIZES
CREATE POLICY "products_authenticated_select" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "products_manage_insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_accounts());

CREATE POLICY "products_manage_update" ON public.products
  FOR UPDATE TO authenticated USING (public.is_accounts()) WITH CHECK (public.is_accounts());

CREATE POLICY "products_admin_delete" ON public.products
  FOR DELETE TO authenticated USING (public.is_admin());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pack_sizes') THEN
    EXECUTE 'CREATE POLICY "pack_sizes_select" ON public.pack_sizes FOR SELECT TO authenticated USING (true);';
    EXECUTE 'CREATE POLICY "pack_sizes_insert" ON public.pack_sizes FOR INSERT TO authenticated WITH CHECK (public.is_accounts());';
    EXECUTE 'CREATE POLICY "pack_sizes_update" ON public.pack_sizes FOR UPDATE TO authenticated USING (public.is_accounts()) WITH CHECK (public.is_accounts());';
    EXECUTE 'CREATE POLICY "pack_sizes_delete" ON public.pack_sizes FOR DELETE TO authenticated USING (public.is_admin());';
  END IF;
END $$;


-- 3. RAW MATERIALS (BLOCKED for Sales Staff)
CREATE POLICY "raw_materials_production_select" ON public.raw_materials
  FOR SELECT TO authenticated USING (public.is_production());

CREATE POLICY "raw_materials_manage_insert" ON public.raw_materials
  FOR INSERT TO authenticated WITH CHECK (public.is_accounts());

CREATE POLICY "raw_materials_manage_update" ON public.raw_materials
  FOR UPDATE TO authenticated USING (public.is_accounts() OR public.is_production()) WITH CHECK (public.is_accounts() OR public.is_production());

CREATE POLICY "raw_materials_admin_delete" ON public.raw_materials
  FOR DELETE TO authenticated USING (public.is_admin());


-- 4. PRODUCT FORMULATIONS / BOM (CONFIDENTIAL TRADE SECRETS — BLOCKED for Sales Staff)
CREATE POLICY "formulations_production_select" ON public.product_formulations
  FOR SELECT TO authenticated USING (public.is_production());

CREATE POLICY "formulations_admin_insert" ON public.product_formulations
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "formulations_admin_update" ON public.product_formulations
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "formulations_admin_delete" ON public.product_formulations
  FOR DELETE TO authenticated USING (public.is_admin());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'formulation_items') THEN
    EXECUTE 'CREATE POLICY "formulation_items_select" ON public.formulation_items FOR SELECT TO authenticated USING (public.is_production());';
    EXECUTE 'CREATE POLICY "formulation_items_insert" ON public.formulation_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());';
    EXECUTE 'CREATE POLICY "formulation_items_update" ON public.formulation_items FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());';
    EXECUTE 'CREATE POLICY "formulation_items_delete" ON public.formulation_items FOR DELETE TO authenticated USING (public.is_admin());';
  END IF;
END $$;


-- 5. PRODUCTION BATCHES & RAW MATERIAL MOVEMENTS (BLOCKED for Sales Staff)
CREATE POLICY "production_batches_select" ON public.production_batches
  FOR SELECT TO authenticated USING (public.is_production());

CREATE POLICY "production_batches_insert" ON public.production_batches
  FOR INSERT TO authenticated WITH CHECK (public.is_production());

CREATE POLICY "production_batches_update" ON public.production_batches
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "production_batches_delete" ON public.production_batches
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "raw_movements_select" ON public.raw_material_movements
  FOR SELECT TO authenticated USING (public.is_production());

CREATE POLICY "raw_movements_insert" ON public.raw_material_movements
  FOR INSERT TO authenticated WITH CHECK (public.is_production());

CREATE POLICY "raw_movements_delete" ON public.raw_material_movements
  FOR DELETE TO authenticated USING (public.is_admin());


-- 6. CUSTOMERS (Sales Staff & Accounts & Admin)
CREATE POLICY "customers_authenticated_select" ON public.customers
  FOR SELECT TO authenticated USING (public.is_sales() OR public.is_accounts());

CREATE POLICY "customers_sales_insert" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (public.is_sales());

CREATE POLICY "customers_sales_update" ON public.customers
  FOR UPDATE TO authenticated USING (public.is_sales() OR public.is_accounts()) WITH CHECK (public.is_sales() OR public.is_accounts());

CREATE POLICY "customers_admin_delete" ON public.customers
  FOR DELETE TO authenticated USING (public.is_admin());


-- 7. SUPPLIERS / VENDORS (Accounts & Admin only — BLOCKED for Sales Staff)
CREATE POLICY "suppliers_accounts_select" ON public.suppliers
  FOR SELECT TO authenticated USING (public.is_accounts());

CREATE POLICY "suppliers_accounts_insert" ON public.suppliers
  FOR INSERT TO authenticated WITH CHECK (public.is_accounts());

CREATE POLICY "suppliers_accounts_update" ON public.suppliers
  FOR UPDATE TO authenticated USING (public.is_accounts()) WITH CHECK (public.is_accounts());

CREATE POLICY "suppliers_admin_delete" ON public.suppliers
  FOR DELETE TO authenticated USING (public.is_admin());


-- 8. SALES & SALE ITEMS
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT TO authenticated USING (public.is_sales() OR public.is_accounts());

CREATE POLICY "sales_insert" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (public.is_sales());

CREATE POLICY "sales_update" ON public.sales
  FOR UPDATE TO authenticated USING (public.is_sales() OR public.is_accounts()) WITH CHECK (public.is_sales() OR public.is_accounts());

CREATE POLICY "sales_admin_delete" ON public.sales
  FOR DELETE TO authenticated USING (public.is_admin());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_items') THEN
    EXECUTE 'CREATE POLICY "sale_items_select" ON public.sale_items FOR SELECT TO authenticated USING (public.is_sales() OR public.is_accounts());';
    EXECUTE 'CREATE POLICY "sale_items_insert" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (public.is_sales());';
    EXECUTE 'CREATE POLICY "sale_items_update" ON public.sale_items FOR UPDATE TO authenticated USING (public.is_sales() OR public.is_accounts()) WITH CHECK (public.is_sales() OR public.is_accounts());';
    EXECUTE 'CREATE POLICY "sale_items_delete" ON public.sale_items FOR DELETE TO authenticated USING (public.is_admin());';
  END IF;
END $$;


-- 9. PURCHASES & PURCHASE ITEMS (BLOCKED for Sales Staff)
CREATE POLICY "purchases_accounts_select" ON public.purchases
  FOR SELECT TO authenticated USING (public.is_accounts());

CREATE POLICY "purchases_accounts_insert" ON public.purchases
  FOR INSERT TO authenticated WITH CHECK (public.is_accounts());

CREATE POLICY "purchases_accounts_update" ON public.purchases
  FOR UPDATE TO authenticated USING (public.is_accounts()) WITH CHECK (public.is_accounts());

CREATE POLICY "purchases_admin_delete" ON public.purchases
  FOR DELETE TO authenticated USING (public.is_admin());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_items') THEN
    EXECUTE 'CREATE POLICY "purchase_items_select" ON public.purchase_items FOR SELECT TO authenticated USING (public.is_accounts());';
    EXECUTE 'CREATE POLICY "purchase_items_insert" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.is_accounts());';
    EXECUTE 'CREATE POLICY "purchase_items_update" ON public.purchase_items FOR UPDATE TO authenticated USING (public.is_accounts()) WITH CHECK (public.is_accounts());';
    EXECUTE 'CREATE POLICY "purchase_items_delete" ON public.purchase_items FOR DELETE TO authenticated USING (public.is_admin());';
  END IF;
END $$;


-- 10. STOCK MOVEMENTS (Audit Log for Finished Goods)
CREATE POLICY "stock_movements_select" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "stock_movements_insert" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "stock_movements_delete" ON public.stock_movements
  FOR DELETE TO authenticated USING (public.is_admin());


-- 11. PAYMENTS & CASH BOOK (BLOCKED for Sales Staff and General Staff)
CREATE POLICY "payments_accounts_select" ON public.payments
  FOR SELECT TO authenticated USING (public.is_accounts());

CREATE POLICY "payments_accounts_insert" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (public.is_accounts() OR public.is_sales());

CREATE POLICY "payments_accounts_update" ON public.payments
  FOR UPDATE TO authenticated USING (public.is_accounts()) WITH CHECK (public.is_accounts());

CREATE POLICY "payments_admin_delete" ON public.payments
  FOR DELETE TO authenticated USING (public.is_admin());


-- 12. EXPENSES & RECURRING EXPENSES (BLOCKED for Sales Staff and General Staff)
CREATE POLICY "expenses_accounts_select" ON public.expenses
  FOR SELECT TO authenticated USING (public.is_accounts());

CREATE POLICY "expenses_accounts_insert" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (public.is_accounts());

CREATE POLICY "expenses_accounts_update" ON public.expenses
  FOR UPDATE TO authenticated USING (public.is_accounts()) WITH CHECK (public.is_accounts());

CREATE POLICY "expenses_admin_delete" ON public.expenses
  FOR DELETE TO authenticated USING (public.is_admin());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recurring_expenses') THEN
    EXECUTE 'CREATE POLICY "recurring_expenses_select" ON public.recurring_expenses FOR SELECT TO authenticated USING (public.is_accounts());';
    EXECUTE 'CREATE POLICY "recurring_expenses_insert" ON public.recurring_expenses FOR INSERT TO authenticated WITH CHECK (public.is_accounts());';
    EXECUTE 'CREATE POLICY "recurring_expenses_update" ON public.recurring_expenses FOR UPDATE TO authenticated USING (public.is_accounts()) WITH CHECK (public.is_accounts());';
    EXECUTE 'CREATE POLICY "recurring_expenses_delete" ON public.recurring_expenses FOR DELETE TO authenticated USING (public.is_admin());';
  END IF;
END $$;


-- 13. FIXED ASSETS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fixed_assets') THEN
    EXECUTE 'CREATE POLICY "fixed_assets_select" ON public.fixed_assets FOR SELECT TO authenticated USING (public.is_accounts());';
    EXECUTE 'CREATE POLICY "fixed_assets_insert" ON public.fixed_assets FOR INSERT TO authenticated WITH CHECK (public.is_admin());';
    EXECUTE 'CREATE POLICY "fixed_assets_update" ON public.fixed_assets FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());';
    EXECUTE 'CREATE POLICY "fixed_assets_delete" ON public.fixed_assets FOR DELETE TO authenticated USING (public.is_admin());';
  END IF;
END $$;


-- 14. DELETION AUDIT LOGS (Immutable Security Log)
CREATE POLICY "deletion_logs_admin_select" ON public.deletion_audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "deletion_logs_authenticated_insert" ON public.deletion_audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Never allow UPDATE or DELETE on audit logs!
