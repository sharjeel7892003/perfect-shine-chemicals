-- ==============================================================================
-- PERFECT SHINE CHEMICALS — FACTORY MANAGEMENT SYSTEM (POS & ERP)
-- SUPABASE POSTGRESQL SCHEMA (PHASE 1, 2 & 3 EXTENSIONS)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES & USER ROLES
-- Role types: 'owner', 'sales_staff', 'accounts_staff', 'general_staff'
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN ('owner', 'sales_staff', 'accounts_staff', 'general_staff')) DEFAULT 'sales_staff',
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PRODUCTS TABLE (SINGLE BASE UNIT TRACKING)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'Chemicals',
    unit TEXT NOT NULL DEFAULT 'liter' CHECK (unit IN ('liter', 'kg', 'pcs', 'bottle', 'can', 'drum', 'carton')),
    base_unit TEXT NOT NULL DEFAULT 'liter' CHECK (base_unit IN ('liter', 'kg')), -- Single source of truth
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Single stock number strictly in base_unit
    reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 10.00,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false, -- Soft delete flag for products with transaction history
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PACKAGING / PACK SIZES TABLE (CONVERSION REFERENCE ONLY)
CREATE TABLE IF NOT EXISTS public.pack_sizes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "500ml Bottle", "5L Can", "Bulk / Loose"
    size_in_base_unit NUMERIC(12, 4) NOT NULL DEFAULT 1.00, -- Multiplier e.g. 0.5, 1.0, 5.0
    unit_label TEXT NOT NULL DEFAULT 'bottle', -- "bottle", "can", "bag", "liter", "kg"
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RAW MATERIALS ENTITY TABLE
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- e.g. "LABSA 96%", "SLES 70%", "Caustic Soda"
    category TEXT DEFAULT 'Surfactants',
    unit TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'liter')),
    current_stock NUMERIC(12, 4) NOT NULL DEFAULT 0.00,
    reorder_level NUMERIC(12, 4) NOT NULL DEFAULT 50.00,
    cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PRODUCT FORMULATIONS (BILL OF MATERIALS / RECIPES)
CREATE TABLE IF NOT EXISTS public.product_formulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID UNIQUE NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    base_unit TEXT NOT NULL DEFAULT 'liter' CHECK (base_unit IN ('liter', 'kg')),
    yield_quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.00, -- Standard 1.0 base unit
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. FORMULATION ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.formulation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    formulation_id UUID NOT NULL REFERENCES public.product_formulations(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
    raw_material_name TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.00, -- Amount required per 1 base unit
    unit TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'liter')),
    cost_per_unit NUMERIC(12, 2) DEFAULT 0.00
);

-- 7. PRODUCTION BATCHES TABLE
CREATE TABLE IF NOT EXISTS public.production_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number TEXT UNIQUE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity_produced NUMERIC(12, 4) NOT NULL, -- in base unit
    base_unit TEXT NOT NULL DEFAULT 'liter',
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supervisor_name TEXT,
    total_batch_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost_per_base_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. CONSUMED RAW MATERIALS IN PRODUCTION TABLE
CREATE TABLE IF NOT EXISTS public.consumed_raw_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_batch_id UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
    raw_material_id UUID REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
    raw_material_name TEXT NOT NULL,
    quantity_consumed NUMERIC(12, 4) NOT NULL,
    unit TEXT NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

-- 9. RAW MATERIAL MOVEMENTS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.raw_material_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    raw_material_name TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase_in', 'production_out', 'adjustment', 'wastage', 'return')),
    quantity NUMERIC(12, 4) NOT NULL, -- Positive for in, negative for out
    previous_stock NUMERIC(12, 4),
    new_stock NUMERIC(12, 4),
    reference_id TEXT, -- Batch # or PO #
    notes TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 10. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT DEFAULT 'Lahore',
    customer_type TEXT NOT NULL DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale', 'distributor')),
    credit_limit NUMERIC(12, 2) DEFAULT 50000.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT DEFAULT 'Lahore',
    raw_material_type TEXT,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. SALES TABLE (INVOICES)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partial', 'unpaid', 'credit')),
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'jazzcash', 'easypaisa', 'cheque', 'credit')),
    salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. SALE ITEMS TABLE (WITH PACK SIZE CONVERSION)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    pack_size_id UUID REFERENCES public.pack_sizes(id) ON DELETE SET NULL,
    pack_size_name TEXT,
    pack_quantity NUMERIC(12, 2),
    size_in_base_unit NUMERIC(12, 4) DEFAULT 1.00,
    base_quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.00, -- Amount deducted from single finished stock
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

-- 14. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'jazzcash', 'easypaisa', 'cheque')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. PURCHASE ITEMS TABLE (RAW MATERIALS OR PRODUCTS)
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    item_type TEXT DEFAULT 'raw_material' CHECK (item_type IN ('raw_material', 'finished_product', 'general')),
    raw_material_id UUID REFERENCES public.raw_materials(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_or_material_name TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.00,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

-- 16. FINISHED GOODS STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase_in', 'sale_out', 'adjustment', 'production', 'wastage', 'return')),
    quantity NUMERIC(12, 4) NOT NULL, -- in base_unit
    previous_stock NUMERIC(12, 4),
    new_stock NUMERIC(12, 4),
    reference_id TEXT,
    notes TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 17. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    related_to TEXT NOT NULL CHECK (related_to IN ('sale', 'purchase', 'customer_balance', 'supplier_balance')),
    reference_id UUID,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'jazzcash', 'easypaisa', 'cheque')),
    transaction_ref TEXT,
    notes TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Enablement
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_formulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumed_raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
