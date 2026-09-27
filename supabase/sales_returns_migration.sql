-- ==============================================================================
-- SALES RETURNS & CREDIT NOTES MODULE MIGRATION
-- PERFECT SHINE CHEMICALS — POS & ERP SYSTEM
-- ==============================================================================

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

-- 3. INDEXES FOR HIGH-PERFORMANCE LOOKUPS
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale_id ON public.sales_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer_id ON public.sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON public.sales_returns(date);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return_id ON public.sales_return_items(return_id);

-- 4. ROW LEVEL SECURITY
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_returns' AND policyname = 'Allow authenticated users full access on sales_returns'
  ) THEN
    CREATE POLICY "Allow authenticated users full access on sales_returns"
    ON public.sales_returns FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_returns' AND policyname = 'Allow anon users full access on sales_returns'
  ) THEN
    CREATE POLICY "Allow anon users full access on sales_returns"
    ON public.sales_returns FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_return_items' AND policyname = 'Allow authenticated users full access on sales_return_items'
  ) THEN
    CREATE POLICY "Allow authenticated users full access on sales_return_items"
    ON public.sales_return_items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_return_items' AND policyname = 'Allow anon users full access on sales_return_items'
  ) THEN
    CREATE POLICY "Allow anon users full access on sales_return_items"
    ON public.sales_return_items FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
