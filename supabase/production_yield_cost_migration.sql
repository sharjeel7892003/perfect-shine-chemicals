-- ==============================================================================
-- PRODUCTION YIELD & COST CALCULATION MIGRATION
-- Supports separate tracking for theoretical formulation recipe scale vs 
-- real physical output produced (water added, dilution, process yield)
-- ==============================================================================

ALTER TABLE public.production_batches 
  ADD COLUMN IF NOT EXISTS formulation_batch_size NUMERIC(12, 4) DEFAULT 1.0;

COMMENT ON COLUMN public.production_batches.formulation_batch_size IS 
  'Nominal recipe scale mixed based on formulation ratios. Controls raw material consumption, while quantity_produced acts as the cost divisor.';
