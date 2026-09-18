-- Migration: Support selling raw materials directly to customers
-- Run this in your Supabase Project SQL Editor to update schema:

-- 1. Add sellable flag and resale selling_price to raw_materials
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2) DEFAULT 0.00;

-- 2. Add raw_material_id and item_type to sale_items table
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'finished_product';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS raw_material_id TEXT;

-- 3. Ensure product_id can be NULL when raw_material_id is provided
ALTER TABLE public.sale_items ALTER COLUMN product_id DROP NOT NULL;
