-- ==============================================================================
-- PRODUCTION BATCH REVERSAL & MOVEMENT TYPE CHECK CONSTRAINT MIGRATION
-- ==============================================================================
-- This migration:
-- 1. Adds 'production_reversal' to the raw_material_movements CHECK constraint,
--    while preserving all existing valid movement types.
-- 2. Adds 'production_reversal' to the stock_movements CHECK constraint.
-- 3. Ensures stock_movements has the product_name column.
-- 4. Creates an atomic PostgreSQL transaction function:
--    reverse_and_delete_production_batch(p_batch_id, p_user_name, p_user_role)
-- ==============================================================================

-- 1. Ensure stock_movements has product_name column
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS product_name TEXT;

-- 2. Update CHECK constraint on raw_material_movements
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

-- 3. Update CHECK constraint on stock_movements
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

-- 4. Atomic Database Function for Production Batch Reversal & Deletion
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
  -- A. Fetch target batch
  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production batch not found (ID: %)', p_batch_id;
  END IF;

  -- B. Fetch product and verify bulk stock
  SELECT * INTO v_product FROM public.products WHERE id = v_batch.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found (ID: %)', v_batch.product_id;
  END IF;

  v_prod_current_stock := COALESCE(v_product.current_stock, 0);

  -- Safety Check: Cannot drive bulk stock negative
  IF v_prod_current_stock < v_batch.quantity_produced THEN
    RAISE EXCEPTION 'Cannot delete batch: Output was already consumed or sold. Current bulk stock is % %, but batch produced % %. Shortfall: % %.',
      v_prod_current_stock, COALESCE(v_batch.base_unit, 'units'),
      v_batch.quantity_produced, COALESCE(v_batch.base_unit, 'units'),
      ROUND((v_batch.quantity_produced - v_prod_current_stock)::numeric, 4), COALESCE(v_batch.base_unit, 'units');
  END IF;

  v_prod_new_stock := ROUND((v_prod_current_stock - v_batch.quantity_produced)::numeric, 4);

  -- C. Restore Consumed Raw Materials
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
        -- Get current stock
        SELECT current_stock INTO v_rm_current_stock FROM public.raw_materials WHERE id = v_rm_id;
        IF FOUND THEN
          v_rm_new_stock := ROUND((COALESCE(v_rm_current_stock, 0) + v_qty_consumed)::numeric, 4);

          -- Update raw material inventory
          UPDATE public.raw_materials 
          SET current_stock = v_rm_new_stock, updated_at = v_now
          WHERE id = v_rm_id;

          -- Record reversal movement entry
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

  -- D. Deduct Product Bulk Stock
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

  -- E. Record Deletion Audit Log Entry
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

  -- F. Delete the batch record
  DELETE FROM public.production_batches WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_number', v_batch.batch_number,
    'message', FORMAT('Production Batch %s reversed and deleted successfully.', v_batch.batch_number)
  );
END;
$$;
