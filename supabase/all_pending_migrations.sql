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

-- ==============================================================================
-- 6. PRODUCTION BATCHES: SEPARATE RECIPE SCALE FROM ACTUAL OUTPUT YIELD
-- ==============================================================================
ALTER TABLE public.production_batches 
  ADD COLUMN IF NOT EXISTS formulation_batch_size NUMERIC(12, 4) DEFAULT 1.0;

-- ==============================================================================
-- 7. SALES RETURNS & CREDIT NOTES MODULE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sales_returns (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    credit_note_number TEXT UNIQUE NOT NULL,
    sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reason TEXT,
    notes TEXT,
    refund_method TEXT NOT NULL DEFAULT 'reduce_receivable',
    payment_method TEXT,
    refund_payment_id TEXT,
    created_by TEXT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_return_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    return_id TEXT NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
    sale_item_id TEXT,
    item_type TEXT NOT NULL DEFAULT 'finished_product',
    product_id TEXT,
    raw_material_id TEXT,
    product_name TEXT NOT NULL,
    unit TEXT,
    pack_size_id TEXT,
    pack_size_name TEXT,
    size_in_base_unit NUMERIC(12, 4),
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    base_quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_sale_id ON public.sales_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer_id ON public.sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON public.sales_returns(date);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return_id ON public.sales_return_items(return_id);

GRANT ALL ON public.sales_returns TO authenticated;
GRANT ALL ON public.sales_returns TO anon;
GRANT ALL ON public.sales_return_items TO authenticated;
GRANT ALL ON public.sales_return_items TO anon;

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users read on sales_returns" ON public.sales_returns;
CREATE POLICY "Allow all users read on sales_returns" ON public.sales_returns FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all users manage on sales_returns" ON public.sales_returns;
CREATE POLICY "Allow all users manage on sales_returns" ON public.sales_returns FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users read on sales_return_items" ON public.sales_return_items;
CREATE POLICY "Allow all users read on sales_return_items" ON public.sales_return_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all users manage on sales_return_items" ON public.sales_return_items;
CREATE POLICY "Allow all users manage on sales_return_items" ON public.sales_return_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_related_to_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_related_to_check 
  CHECK (related_to IN ('sale', 'purchase', 'customer_balance', 'supplier_balance', 'expense', 'capital_injection', 'owner_withdrawal', 'customer_advance', 'sales_return_refund'));

ALTER TABLE public.deletion_audit_logs DROP CONSTRAINT IF EXISTS deletion_audit_logs_entity_type_check;
ALTER TABLE public.deletion_audit_logs ADD CONSTRAINT deletion_audit_logs_entity_type_check 
  CHECK (entity_type IN ('customer', 'supplier', 'product', 'raw_material', 'sale', 'purchase', 'formulation', 'staff', 'production_batch', 'expense', 'sales_return'));

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_returns, public.sales_return_items;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- ==============================================================================
-- 5. PRODUCTION BATCH REVERSAL & CHECK CONSTRAINT MIGRATION
-- ==============================================================================
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS product_name TEXT;

ALTER TABLE public.raw_material_movements 
  DROP CONSTRAINT IF EXISTS raw_material_movements_movement_type_check;

ALTER TABLE public.raw_material_movements 
  ADD CONSTRAINT raw_material_movements_movement_type_check 
  CHECK (movement_type IN (
    'purchase_in', 
    'production_out', 
    'production_reversal', 
    'packaging_out', 
    'adjustment', 
    'return', 
    'sale_out', 
    'resale_out', 
    'wastage'
  ));

ALTER TABLE public.stock_movements 
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE public.stock_movements 
  ADD CONSTRAINT stock_movements_movement_type_check 
  CHECK (movement_type IN (
    'purchase_in', 
    'production', 
    'production_reversal', 
    'packaging_out', 
    'sale_out', 
    'adjustment', 
    'wastage', 
    'return'
  ));

CREATE OR REPLACE FUNCTION public.reverse_and_delete_production_batch(
  p_batch_id UUID,
  p_user_name TEXT,
  p_user_role TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch RECORD;
  v_product RECORD;
  v_item JSONB;
  v_rm_id UUID;
  v_rm_name TEXT;
  v_qty_consumed NUMERIC;
  v_rm_current_stock NUMERIC;
  v_rm_new_stock NUMERIC;
  v_prod_current_stock NUMERIC;
  v_prod_new_stock NUMERIC;
  v_consumed_array JSONB;
  v_now TIMESTAMPTZ := NOW();
  v_log_id UUID := gen_random_uuid();
BEGIN
  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production batch not found (ID: %)', p_batch_id;
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = v_batch.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found (ID: %)', v_batch.product_id;
  END IF;

  v_prod_current_stock := COALESCE(v_product.current_stock, 0);

  IF v_prod_current_stock < v_batch.quantity_produced THEN
    RAISE EXCEPTION 'Cannot delete batch: Output was already consumed or sold. Current bulk stock is % %, but batch produced % %. Shortfall: % %.',
      v_prod_current_stock, COALESCE(v_batch.base_unit, 'units'),
      v_batch.quantity_produced, COALESCE(v_batch.base_unit, 'units'),
      ROUND((v_batch.quantity_produced - v_prod_current_stock)::numeric, 4), COALESCE(v_batch.base_unit, 'units');
  END IF;

  v_prod_new_stock := ROUND((v_prod_current_stock - v_batch.quantity_produced)::numeric, 4);

  v_consumed_array := v_batch.raw_materials_consumed;
  IF v_consumed_array IS NOT NULL AND jsonb_typeof(v_consumed_array) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_consumed_array)
    LOOP
      BEGIN
        v_rm_id := (v_item->>'raw_material_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_rm_id := NULL;
      END;

      v_rm_name := COALESCE(v_item->>'raw_material_name', 'Unknown Material');
      v_qty_consumed := COALESCE((v_item->>'quantity_consumed')::numeric, 0);

      IF v_rm_id IS NOT NULL AND v_qty_consumed > 0 THEN
        SELECT current_stock INTO v_rm_current_stock FROM public.raw_materials WHERE id = v_rm_id;
        IF FOUND THEN
          v_rm_new_stock := ROUND((COALESCE(v_rm_current_stock, 0) + v_qty_consumed)::numeric, 4);

          UPDATE public.raw_materials 
          SET current_stock = v_rm_new_stock, updated_at = v_now
          WHERE id = v_rm_id;

          INSERT INTO public.raw_material_movements (
            id,
            raw_material_id,
            raw_material_name,
            movement_type,
            quantity,
            previous_stock,
            new_stock,
            reference_id,
            notes,
            date
          ) VALUES (
            gen_random_uuid(),
            v_rm_id,
            v_rm_name,
            'production_reversal',
            v_qty_consumed,
            COALESCE(v_rm_current_stock, 0),
            v_rm_new_stock,
            v_batch.batch_number,
            FORMAT('Restored raw material from reversed production batch %s [By %s]', v_batch.batch_number, p_user_name),
            v_now
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.products 
  SET current_stock = v_prod_new_stock, updated_at = v_now
  WHERE id = v_product.id;

  INSERT INTO public.stock_movements (
    id,
    product_id,
    product_name,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reference_id,
    notes,
    date
  ) VALUES (
    gen_random_uuid(),
    v_product.id,
    v_product.name,
    'production_reversal',
    -v_batch.quantity_produced,
    v_prod_current_stock,
    v_prod_new_stock,
    v_batch.batch_number,
    FORMAT('Deducted finished output of reversed batch %s [By %s]', v_batch.batch_number, p_user_name),
    v_now
  );

  INSERT INTO public.deletion_audit_logs (
    id,
    entity_type,
    entity_id,
    entity_title,
    action_type,
    impact_summary,
    performed_by,
    performed_by_role,
    reversal_details,
    date
  ) VALUES (
    v_log_id,
    'production_batch',
    p_batch_id::text,
    FORMAT('Batch %s (%s)', v_batch.batch_number, v_batch.product_name),
    'reversed_and_deleted',
    FORMAT('Reversed Batch %s: Restored %s raw materials, deducted %s %s bulk stock.', 
      v_batch.batch_number, 
      COALESCE(jsonb_array_length(v_consumed_array), 0),
      v_batch.quantity_produced, 
      COALESCE(v_batch.base_unit, 'units')
    ),
    p_user_name,
    p_user_role,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'product_name', v_batch.product_name,
      'quantity_produced', v_batch.quantity_produced,
      'base_unit', v_batch.base_unit,
      'raw_materials_consumed', v_consumed_array
    ),
    v_now
  );

  DELETE FROM public.production_batches WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_number', v_batch.batch_number,
    'message', FORMAT('Production Batch %s reversed and deleted successfully.', v_batch.batch_number)
  );
END;
$$;

-- ==============================================================================
-- 10. PRICE QUOTATIONS & PROPOSALS MODULE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.quotations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    quotation_number TEXT UNIQUE NOT NULL,
    quotation_type TEXT NOT NULL DEFAULT 'private_label',
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    email TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    validity_period TEXT NOT NULL DEFAULT 'Valid for 15 days',
    status TEXT NOT NULL DEFAULT 'pending',
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

CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON public.quotations(date);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON public.quotation_items(quotation_id);

GRANT ALL ON public.quotations TO authenticated;
GRANT ALL ON public.quotation_items TO authenticated;
GRANT ALL ON public.quotations TO anon;
GRANT ALL ON public.quotation_items TO anon;

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotations_select_authenticated" ON public.quotations;
CREATE POLICY "quotations_select_authenticated" ON public.quotations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "quotations_manage_authenticated" ON public.quotations;
CREATE POLICY "quotations_manage_authenticated" ON public.quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "quotation_items_select_authenticated" ON public.quotation_items;
CREATE POLICY "quotation_items_select_authenticated" ON public.quotation_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "quotation_items_manage_authenticated" ON public.quotation_items;
CREATE POLICY "quotation_items_manage_authenticated" ON public.quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 11. SALES COMMISSION SYSTEM (SALESPERSONS, CLOSURES, COMMISSION PAYMENTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.salespersons (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.salespersons (id, name, commission_rate, is_active)
VALUES 
    ('sp_sharjeel_initial', 'Sharjeel', 10.00, true),
    ('sp_aqeel_initial', 'Aqeel', 10.00, true),
    ('sp_ilyas_initial', 'Ilyas', 10.00, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS salesperson_id TEXT;

CREATE TABLE IF NOT EXISTS public.monthly_commission_closures (
    month TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS public.commission_payments (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    salesperson_id TEXT NOT NULL REFERENCES public.salespersons(id) ON DELETE RESTRICT,
    salesperson_name TEXT NOT NULL,
    month TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_date DATE NOT NULL,
    payment_id TEXT,
    notes TEXT,
    recorded_by TEXT,
    recorded_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.salespersons TO authenticated;
GRANT ALL ON public.monthly_commission_closures TO authenticated;
GRANT ALL ON public.commission_payments TO authenticated;

ALTER TABLE public.salespersons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_commission_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salespersons_select_auth" ON public.salespersons;
CREATE POLICY "salespersons_select_auth" ON public.salespersons FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "salespersons_admin_manage" ON public.salespersons;
CREATE POLICY "salespersons_admin_manage" ON public.salespersons FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "closures_admin_all" ON public.monthly_commission_closures;
CREATE POLICY "closures_admin_all" ON public.monthly_commission_closures FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "commission_payments_admin_all" ON public.commission_payments;
CREATE POLICY "commission_payments_admin_all" ON public.commission_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 12. SALES RETURNS & CREDIT NOTES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sales_returns (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    credit_note_number TEXT UNIQUE NOT NULL,
    sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reason TEXT,
    notes TEXT,
    refund_method TEXT NOT NULL DEFAULT 'reduce_receivable',
    payment_method TEXT,
    refund_payment_id TEXT,
    created_by TEXT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_return_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    return_id TEXT NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
    sale_item_id TEXT,
    item_type TEXT NOT NULL DEFAULT 'finished_product',
    product_id TEXT,
    raw_material_id TEXT,
    product_name TEXT NOT NULL,
    unit TEXT,
    pack_size_id TEXT,
    pack_size_name TEXT,
    size_in_base_unit NUMERIC(12, 4),
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    base_quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.sales_returns TO authenticated;
GRANT ALL ON public.sales_return_items TO authenticated;

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_returns_all_auth" ON public.sales_returns;
CREATE POLICY "sales_returns_all_auth" ON public.sales_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sales_return_items_all_auth" ON public.sales_return_items;
CREATE POLICY "sales_return_items_all_auth" ON public.sales_return_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 13. PURCHASE TRIPS & TRANSPORT FREIGHT ALLOCATION
-- ==============================================================================
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS trip_id TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS trip_number TEXT;

ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS allocated_freight NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS landed_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS trip_id TEXT;

CREATE TABLE IF NOT EXISTS public.purchase_trips (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    trip_number TEXT UNIQUE NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_transport_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    transport_payment_method TEXT DEFAULT 'cash',
    transport_notes TEXT,
    vehicle_or_driver TEXT,
    include_pcs_in_weight_allocation BOOLEAN DEFAULT FALSE,
    total_material_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_weight_kg_liter NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_trip_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    trip_id TEXT NOT NULL REFERENCES public.purchase_trips(id) ON DELETE CASCADE,
    supplier_id TEXT,
    supplier_name TEXT NOT NULL,
    raw_material_id TEXT NOT NULL,
    raw_material_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_weight_allocated BOOLEAN DEFAULT TRUE,
    allocation_percentage NUMERIC(6, 2) DEFAULT 0.00,
    allocated_freight NUMERIC(12, 2) DEFAULT 0.00,
    landed_cost NUMERIC(12, 2) DEFAULT 0.00,
    total_landed_cost NUMERIC(12, 2) DEFAULT 0.00,
    purchase_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.purchase_trips TO authenticated;
GRANT ALL ON public.purchase_trip_items TO authenticated;

ALTER TABLE public.purchase_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_trip_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_trips_all_auth" ON public.purchase_trips;
CREATE POLICY "purchase_trips_all_auth" ON public.purchase_trips FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "purchase_trip_items_all_auth" ON public.purchase_trip_items;
CREATE POLICY "purchase_trip_items_all_auth" ON public.purchase_trip_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 14. PACKING RUNS (BOTTLING BATCHES)
-- ==============================================================================
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

GRANT ALL ON public.packing_runs TO authenticated;
ALTER TABLE public.packing_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packing_runs_all_auth" ON public.packing_runs;
CREATE POLICY "packing_runs_all_auth" ON public.packing_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 15. REALTIME PUBLICATION EXTENSION
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.quotations, 
      public.quotation_items,
      public.salespersons, 
      public.monthly_commission_closures, 
      public.commission_payments,
      public.sales_returns, 
      public.sales_return_items,
      public.purchase_trips, 
      public.purchase_trip_items,
      public.packing_runs;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- ==============================================================================
-- 16. FIXED ASSETS & PARTNER CAPITAL MODULE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.partners (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL UNIQUE,
    phone TEXT,
    email TEXT,
    initial_capital NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.partners (id, name, is_active, notes)
VALUES 
    (uuid_generate_v4()::text, 'Sharjeel', true, 'Founding Partner'),
    (uuid_generate_v4()::text, 'Aqeel', true, 'Founding Partner')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    asset_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Machinery', 'Equipment', 'Vehicle', 'Furniture', 'Other')),
    purchase_date DATE NOT NULL,
    vendor TEXT,
    total_cost NUMERIC(14, 2) NOT NULL CHECK (total_cost > 0),
    useful_life_years NUMERIC(6, 2) NOT NULL CHECK (useful_life_years > 0),
    salvage_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (salvage_value >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'archived')),
    disposal_date DATE,
    disposal_amount NUMERIC(14, 2) DEFAULT 0.00,
    disposal_notes TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fixed_asset_fundings (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    asset_id TEXT NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
    funding_type TEXT NOT NULL CHECK (funding_type IN ('business', 'partner')),
    business_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT DEFAULT 'bank',
    partner_id TEXT REFERENCES public.partners(id) ON DELETE RESTRICT,
    partner_name TEXT,
    partner_contribution_type TEXT DEFAULT 'capital' CHECK (partner_contribution_type IN ('capital', 'loan')),
    partner_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_capital_transactions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    partner_id TEXT NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
    partner_name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('contribution', 'withdrawal', 'asset_contribution', 'loan_received', 'loan_repayment')),
    contribution_type TEXT NOT NULL DEFAULT 'capital' CHECK (contribution_type IN ('capital', 'loan')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    reference_id TEXT,
    reference_no TEXT,
    reference_type TEXT NOT NULL DEFAULT 'fixed_asset' CHECK (reference_type IN ('fixed_asset', 'cash_injection', 'cash_withdrawal', 'manual')),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_related_to_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_related_to_check 
  CHECK (related_to IN (
    'sale', 'purchase', 'customer_balance', 'supplier_balance', 'expense', 
    'capital_injection', 'owner_withdrawal', 'customer_advance', 'sales_return_refund', 
    'transport', 'sales_commission', 'fixed_asset'
  ));

ALTER TABLE public.deletion_audit_logs DROP CONSTRAINT IF EXISTS deletion_audit_logs_entity_type_check;
ALTER TABLE public.deletion_audit_logs ADD CONSTRAINT deletion_audit_logs_entity_type_check 
  CHECK (entity_type IN (
    'customer', 'supplier', 'product', 'raw_material', 'sale', 'purchase', 
    'formulation', 'staff', 'production_batch', 'expense', 'sales_return', 
    'fixed_asset', 'partner'
  ));

CREATE INDEX IF NOT EXISTS idx_partners_name ON public.partners(name);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON public.fixed_assets(category);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON public.fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_purchase_date ON public.fixed_assets(purchase_date);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_fundings_asset_id ON public.fixed_asset_fundings(asset_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_fundings_partner_id ON public.fixed_asset_fundings(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_capital_transactions_partner_id ON public.partner_capital_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_capital_transactions_date ON public.partner_capital_transactions(date);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_asset_fundings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_capital_transactions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.partners TO authenticated;
GRANT ALL ON public.fixed_assets TO authenticated;
GRANT ALL ON public.fixed_asset_fundings TO authenticated;
GRANT ALL ON public.partner_capital_transactions TO authenticated;

GRANT ALL ON public.partners TO anon;
GRANT ALL ON public.fixed_assets TO anon;
GRANT ALL ON public.fixed_asset_fundings TO anon;
GRANT ALL ON public.partner_capital_transactions TO anon;

DROP POLICY IF EXISTS "partners_read" ON public.partners;
CREATE POLICY "partners_read" ON public.partners FOR SELECT USING (true);
DROP POLICY IF EXISTS "partners_manage" ON public.partners;
CREATE POLICY "partners_manage" ON public.partners FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fixed_assets_read" ON public.fixed_assets;
CREATE POLICY "fixed_assets_read" ON public.fixed_assets FOR SELECT USING (true);
DROP POLICY IF EXISTS "fixed_assets_manage" ON public.fixed_assets;
CREATE POLICY "fixed_assets_manage" ON public.fixed_assets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fixed_asset_fundings_read" ON public.fixed_asset_fundings;
CREATE POLICY "fixed_asset_fundings_read" ON public.fixed_asset_fundings FOR SELECT USING (true);
DROP POLICY IF EXISTS "fixed_asset_fundings_manage" ON public.fixed_asset_fundings;
CREATE POLICY "fixed_asset_fundings_manage" ON public.fixed_asset_fundings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "partner_capital_transactions_read" ON public.partner_capital_transactions;
CREATE POLICY "partner_capital_transactions_read" ON public.partner_capital_transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "partner_capital_transactions_manage" ON public.partner_capital_transactions;
CREATE POLICY "partner_capital_transactions_manage" ON public.partner_capital_transactions FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.partners, 
      public.fixed_assets, 
      public.fixed_asset_fundings, 
      public.partner_capital_transactions;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;



