-- Migration: Allow 'pcs' (pieces) as a valid unit for packaging materials
-- Run this in your Supabase Project SQL Editor to update check constraints:

-- 1. Raw Materials Unit Check Constraint
ALTER TABLE public.raw_materials DROP CONSTRAINT IF EXISTS raw_materials_unit_check;
ALTER TABLE public.raw_materials ADD CONSTRAINT raw_materials_unit_check CHECK (unit IN ('kg', 'liter', 'pcs'));

-- 2. Formulation Items Unit Check Constraint
ALTER TABLE public.formulation_items DROP CONSTRAINT IF EXISTS formulation_items_unit_check;
ALTER TABLE public.formulation_items ADD CONSTRAINT formulation_items_unit_check CHECK (unit IN ('kg', 'liter', 'pcs'));

-- Optional: Convert any existing tagged raw materials to native 'pcs' unit
UPDATE public.raw_materials
SET unit = 'pcs',
    description = TRIM(REPLACE(description, '[unit:pcs]', ''))
WHERE description LIKE '%[unit:pcs]%';
