-- ==============================================================================
-- PERFECT SHINE CHEMICALS — CASH FLOW, OWNER CAPITAL & ADVANCE PAYMENTS MIGRATION
-- Run this in your Supabase Project SQL Editor
-- ==============================================================================

-- 1. Expand check constraint on payments table to include capital injections, owner withdrawals, and customer advances
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
    'customer_advance'
  ));

-- 2. Ensure payment_method accepts 'advance' for sales paid via customer advance balance
-- (If any check constraint exists on payment_method)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_method_check'
    ) THEN
        ALTER TABLE public.payments DROP CONSTRAINT payments_payment_method_check;
        ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check 
          CHECK (payment_method IN ('cash', 'bank', 'jazzcash', 'easypaisa', 'cheque', 'credit', 'advance'));
    END IF;
END $$;
