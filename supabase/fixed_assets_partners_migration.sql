-- ==============================================================================
-- PERFECT SHINE CHEMICALS — FIXED ASSETS & PARTNER CAPITAL MODULE MIGRATION
-- Run this in your Supabase Project -> SQL Editor -> Run
-- ==============================================================================

-- 0. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PARTNERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.partners (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL UNIQUE,
    phone TEXT,
    email TEXT,
    initial_capital NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial partners if not present
INSERT INTO public.partners (id, name, is_active, notes)
VALUES 
    (uuid_generate_v4()::text, 'Sharjeel', true, 'Founding Partner'),
    (uuid_generate_v4()::text, 'Aqeel', true, 'Founding Partner')
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- 2. FIXED ASSETS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    asset_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Machinery', 'Equipment', 'Vehicle', 'Furniture', 'Other')),
    purchase_date DATE NOT NULL,
    vendor TEXT,
    total_cost NUMERIC(14, 2) NOT NULL CHECK (total_cost > 0),
    useful_life_years NUMERIC(6, 2) NOT NULL CHECK (useful_life_years > 0),
    salvage_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (salvage_value >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'archived')),
    disposal_date DATE,
    disposal_amount NUMERIC(14, 2) DEFAULT 0.00,
    disposal_notes TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. FIXED ASSET FUNDING SPLIT (How the asset purchase was paid)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fixed_asset_fundings (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    asset_id TEXT NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
    funding_type TEXT NOT NULL CHECK (funding_type IN ('business', 'partner')),
    business_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT DEFAULT 'bank', -- 'cash' | 'bank' etc.
    partner_id TEXT REFERENCES public.partners(id) ON DELETE RESTRICT,
    partner_name TEXT,
    partner_contribution_type TEXT DEFAULT 'capital' CHECK (partner_contribution_type IN ('capital', 'loan')),
    partner_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. PARTNER CAPITAL TRANSACTIONS (Authoritative Partner Capital Ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.partner_capital_transactions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    partner_id TEXT NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
    partner_name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('contribution', 'withdrawal', 'asset_contribution', 'loan_received', 'loan_repayment')),
    contribution_type TEXT NOT NULL DEFAULT 'capital' CHECK (contribution_type IN ('capital', 'loan')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    reference_id TEXT, -- fixed_asset.id or payment.id
    reference_no TEXT, -- asset_code or payment transaction_ref
    reference_type TEXT NOT NULL DEFAULT 'fixed_asset' CHECK (reference_type IN ('fixed_asset', 'cash_injection', 'cash_withdrawal', 'manual')),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. UPDATE PAYMENTS CONSTRAINT TO SUPPORT FIXED ASSET PURCHASES
-- ==============================================================================
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
    'sales_return_refund', 
    'transport', 
    'sales_commission', 
    'fixed_asset'
  ));

-- ==============================================================================
-- 6. UPDATE DELETION AUDIT LOGS CONSTRAINT
-- ==============================================================================
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
    'sales_return', 
    'fixed_asset', 
    'partner'
  ));

-- ==============================================================================
-- 7. INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_partners_name ON public.partners(name);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON public.fixed_assets(category);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON public.fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_purchase_date ON public.fixed_assets(purchase_date);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_fundings_asset_id ON public.fixed_asset_fundings(asset_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_fundings_partner_id ON public.fixed_asset_fundings(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_capital_transactions_partner_id ON public.partner_capital_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_capital_transactions_date ON public.partner_capital_transactions(date);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_asset_fundings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_capital_transactions ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated and anon (for client operations)
GRANT ALL ON public.partners TO authenticated;
GRANT ALL ON public.fixed_assets TO authenticated;
GRANT ALL ON public.fixed_asset_fundings TO authenticated;
GRANT ALL ON public.partner_capital_transactions TO authenticated;

GRANT ALL ON public.partners TO anon;
GRANT ALL ON public.fixed_assets TO anon;
GRANT ALL ON public.fixed_asset_fundings TO anon;
GRANT ALL ON public.partner_capital_transactions TO anon;

-- Policies for Partners
DROP POLICY IF EXISTS "partners_read" ON public.partners;
CREATE POLICY "partners_read" ON public.partners FOR SELECT USING (true);

DROP POLICY IF EXISTS "partners_manage" ON public.partners;
CREATE POLICY "partners_manage" ON public.partners FOR ALL USING (true) WITH CHECK (true);

-- Policies for Fixed Assets
DROP POLICY IF EXISTS "fixed_assets_read" ON public.fixed_assets;
CREATE POLICY "fixed_assets_read" ON public.fixed_assets FOR SELECT USING (true);

DROP POLICY IF EXISTS "fixed_assets_manage" ON public.fixed_assets;
CREATE POLICY "fixed_assets_manage" ON public.fixed_assets FOR ALL USING (true) WITH CHECK (true);

-- Policies for Fixed Asset Fundings
DROP POLICY IF EXISTS "fixed_asset_fundings_read" ON public.fixed_asset_fundings;
CREATE POLICY "fixed_asset_fundings_read" ON public.fixed_asset_fundings FOR SELECT USING (true);

DROP POLICY IF EXISTS "fixed_asset_fundings_manage" ON public.fixed_asset_fundings;
CREATE POLICY "fixed_asset_fundings_manage" ON public.fixed_asset_fundings FOR ALL USING (true) WITH CHECK (true);

-- Policies for Partner Capital Transactions
DROP POLICY IF EXISTS "partner_capital_transactions_read" ON public.partner_capital_transactions;
CREATE POLICY "partner_capital_transactions_read" ON public.partner_capital_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "partner_capital_transactions_manage" ON public.partner_capital_transactions;
CREATE POLICY "partner_capital_transactions_manage" ON public.partner_capital_transactions FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 9. REALTIME MULTI-DEVICE PUBLICATION
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.partners, 
      public.fixed_assets, 
      public.fixed_asset_fundings, 
      public.partner_capital_transactions;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
