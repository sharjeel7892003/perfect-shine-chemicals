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

