-- Migration: Add density (kg per liter) column to products table
-- Run this in your Supabase Project SQL Editor to update schema:

-- 1. Add density column to products (default 1.0 kg/liter for liquids, kg products need no conversion)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS density NUMERIC(10, 4) DEFAULT 1.0;

-- 2. Comment explaining the field
COMMENT ON COLUMN public.products.density IS 'Specific gravity / density in kg per liter (default 1.0). Used to convert liquid volume to mass (kg and tons) in Production Volume Reports.';
