-- ==============================================================================
-- PURCHASE TRIPS & TRANSPORT FREIGHT ALLOCATION MIGRATION
-- Run this in Supabase SQL Editor to enable persistent relational storage
-- for Purchase Trips and Landed Cost tracking across vendors.
-- ==============================================================================

-- 1. Extend purchases and purchase_items tables with freight & trip links
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS trip_id TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS trip_number TEXT;

ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS allocated_freight NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS landed_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS trip_id TEXT;

-- 2. Create purchase_trips parent table
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

-- 3. Create purchase_trip_items line items table
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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.purchase_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_trip_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "purchase_trips_read" ON public.purchase_trips;
CREATE POLICY "purchase_trips_read" ON public.purchase_trips FOR SELECT USING (true);

DROP POLICY IF EXISTS "purchase_trips_write" ON public.purchase_trips;
CREATE POLICY "purchase_trips_write" ON public.purchase_trips FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "purchase_trip_items_read" ON public.purchase_trip_items;
CREATE POLICY "purchase_trip_items_read" ON public.purchase_trip_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "purchase_trip_items_write" ON public.purchase_trip_items;
CREATE POLICY "purchase_trip_items_write" ON public.purchase_trip_items FOR ALL USING (true) WITH CHECK (true);

-- 6. Add indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_purchase_trips_date ON public.purchase_trips(date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_trip_items_trip ON public.purchase_trip_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_trip ON public.purchase_items(trip_id);
