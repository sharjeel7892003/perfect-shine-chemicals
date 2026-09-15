-- ==============================================================================
-- PERFECT SHINE CHEMICALS — EXPENSES & RECURRING EXPENSES MIGRATION
-- Run this in your Supabase Project SQL Editor to enable cloud sync for Expenses
-- ==============================================================================

-- 1. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    recorded_by TEXT,
    recorded_by_name TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create recurring_expenses template table
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_posted_month TEXT, -- e.g. '2026-09'
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- 4. Policies for expenses
DROP POLICY IF EXISTS "Expenses read" ON public.expenses;
CREATE POLICY "Expenses read" ON public.expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Expenses manage" ON public.expenses;
CREATE POLICY "Expenses manage" ON public.expenses FOR ALL 
  USING (true)
  WITH CHECK (true);

-- 5. Policies for recurring_expenses
DROP POLICY IF EXISTS "Recurring expenses read" ON public.recurring_expenses;
CREATE POLICY "Recurring expenses read" ON public.recurring_expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Recurring expenses manage" ON public.recurring_expenses;
CREATE POLICY "Recurring expenses manage" ON public.recurring_expenses FOR ALL 
  USING (true)
  WITH CHECK (true);

-- 6. Add to Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses, public.recurring_expenses;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
