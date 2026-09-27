-- ==============================================================================
-- SALES RETURNS & CREDIT NOTES MODULE — SUPABASE SQL MIGRATION
-- PERFECT SHINE CHEMICALS — POS & ERP SYSTEM
-- Run this script in your Supabase Project -> SQL Editor -> Run
-- ==============================================================================

-- 0. Enable UUID Extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SALES RETURNS (CREDIT NOTES) PARENT TABLE
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

-- 2. SALES RETURN ITEMS (CREDIT NOTE LINE ITEMS)
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

-- 3. INDEXES FOR FAST REPORTING & LEDGER QUERIES
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale_id ON public.sales_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer_id ON public.sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON public.sales_returns(date);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return_id ON public.sales_return_items(return_id);

-- 4. GRANT TABLE PRIVILEGES TO AUTHENTICATED & ANON ROLES
GRANT ALL ON public.sales_returns TO authenticated;
GRANT ALL ON public.sales_returns TO anon;
GRANT ALL ON public.sales_return_items TO authenticated;
GRANT ALL ON public.sales_return_items TO anon;

-- 5. ENABLE ROW LEVEL SECURITY (RLS) AND CREATE ACCESS POLICIES
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users read on sales_returns" ON public.sales_returns;
CREATE POLICY "Allow all users read on sales_returns"
ON public.sales_returns FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow all users manage on sales_returns" ON public.sales_returns;
CREATE POLICY "Allow all users manage on sales_returns"
ON public.sales_returns FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users read on sales_return_items" ON public.sales_return_items;
CREATE POLICY "Allow all users read on sales_return_items"
ON public.sales_return_items FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow all users manage on sales_return_items" ON public.sales_return_items;
CREATE POLICY "Allow all users manage on sales_return_items"
ON public.sales_return_items FOR ALL
USING (true)
WITH CHECK (true);

-- 6. UPDATE PAYMENTS CONSTRAINT FOR 'sales_return_refund' (CASH BOOK REFUND VOUCHERS)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_related_to_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_related_to_check 
  CHECK (related_to IN (
    'sale', 
    'purchase', 
    'customer_balance', 
    'supplier_balance', 
    'expense', 
    'capital_injection', 
    'owner_withdrawal', 
    'customer_advance', 
    'sales_return_refund'
  ));

-- 7. UPDATE DELETION AUDIT LOG CONSTRAINT FOR 'sales_return'
ALTER TABLE public.deletion_audit_logs DROP CONSTRAINT IF EXISTS deletion_audit_logs_entity_type_check;
ALTER TABLE public.deletion_audit_logs ADD CONSTRAINT deletion_audit_logs_entity_type_check 
  CHECK (entity_type IN (
    'customer', 
    'supplier', 
    'product', 
    'raw_material', 
    'sale', 
    'purchase', 
    'formulation', 
    'staff', 
    'production_batch', 
    'expense', 
    'sales_return'
  ));

-- 8. REALTIME MULTI-DEVICE BROADCAST PUBLICATION
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_returns, public.sales_return_items;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
