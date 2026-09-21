-- ==============================================================================
-- DECIMAL PRECISION MIGRATION
-- Ensures high-precision tracking (up to 4 decimal places) for finished product
-- stock, production batch quantities, and raw material movements.
-- ==============================================================================

-- 1. Finished Products: Allow up to 4 decimal places for liquid liters / chemical kg
ALTER TABLE public.products 
  ALTER COLUMN current_stock TYPE NUMERIC(12, 4),
  ALTER COLUMN reorder_level TYPE NUMERIC(12, 4);

-- 2. Finished Stock Movements: Ensure movement quantities support exact decimals
ALTER TABLE public.stock_movements
  ALTER COLUMN quantity TYPE NUMERIC(12, 4),
  ALTER COLUMN previous_stock TYPE NUMERIC(12, 4),
  ALTER COLUMN new_stock TYPE NUMERIC(12, 4);

-- 3. Production Batches: Ensure quantity_produced supports exact decimals (e.g. 51.500 kg, 360.500 kg)
ALTER TABLE public.production_batches
  ALTER COLUMN quantity_produced TYPE NUMERIC(12, 4);

-- 4. Raw Material Movements: Confirm 4 decimal places
ALTER TABLE public.raw_material_movements
  ALTER COLUMN quantity TYPE NUMERIC(12, 4),
  ALTER COLUMN previous_stock TYPE NUMERIC(12, 4),
  ALTER COLUMN new_stock TYPE NUMERIC(12, 4);

-- 5. Raw Materials: Confirm 4 decimal places
ALTER TABLE public.raw_materials
  ALTER COLUMN current_stock TYPE NUMERIC(12, 4),
  ALTER COLUMN reorder_level TYPE NUMERIC(12, 4);
