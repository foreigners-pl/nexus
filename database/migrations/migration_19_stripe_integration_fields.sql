-- Migration 19: Add Stripe Integration Fields
-- Date: 2025-12-31
-- Description: Adds necessary fields for full Stripe invoice integration

-- ============================================
-- 1. Add stripe_customer_id to clients table
-- This is REQUIRED to create invoices in Stripe
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN stripe_customer_id VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id ON clients(stripe_customer_id);
    RAISE NOTICE 'Added stripe_customer_id to clients table';
  ELSE
    RAISE NOTICE 'stripe_customer_id already exists in clients table';
  END IF;
END $$;

-- ============================================
-- 2. Add currency field to invoices table
-- Stripe requires currency for all invoices
-- Default to 'pln' for Polish Zloty
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'currency'
  ) THEN
    ALTER TABLE invoices ADD COLUMN currency VARCHAR(3) DEFAULT 'pln';
    RAISE NOTICE 'Added currency to invoices table';
  ELSE
    RAISE NOTICE 'currency already exists in invoices table';
  END IF;
END $$;

-- ============================================
-- 3. Add collection_method to invoices
-- 'send_invoice' = email invoice to customer
-- 'charge_automatically' = charge saved payment method
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'collection_method'
  ) THEN
    ALTER TABLE invoices ADD COLUMN collection_method VARCHAR(30) DEFAULT 'send_invoice';
    RAISE NOTICE 'Added collection_method to invoices table';
  ELSE
    RAISE NOTICE 'collection_method already exists in invoices table';
  END IF;
END $$;

-- ============================================
-- 4. Add stripe_hosted_invoice_url to invoices
-- This is the URL where customers can pay
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'stripe_hosted_invoice_url'
  ) THEN
    ALTER TABLE invoices ADD COLUMN stripe_hosted_invoice_url TEXT;
    RAISE NOTICE 'Added stripe_hosted_invoice_url to invoices table';
  ELSE
    RAISE NOTICE 'stripe_hosted_invoice_url already exists in invoices table';
  END IF;
END $$;

-- ============================================
-- 5. Add stripe_invoice_pdf to invoices
-- URL to the PDF version of the invoice
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'stripe_invoice_pdf'
  ) THEN
    ALTER TABLE invoices ADD COLUMN stripe_invoice_pdf TEXT;
    RAISE NOTICE 'Added stripe_invoice_pdf to invoices table';
  ELSE
    RAISE NOTICE 'stripe_invoice_pdf already exists in invoices table';
  END IF;
END $$;

-- ============================================
-- 6. Add voided_at timestamp to invoices
-- Track when invoice was voided
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'voided_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN voided_at TIMESTAMPTZ;
    RAISE NOTICE 'Added voided_at to invoices table';
  ELSE
    RAISE NOTICE 'voided_at already exists in invoices table';
  END IF;
END $$;

-- ============================================
-- 7. Add payment_method to invoices
-- Track how payment was made (for manual payments)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_method VARCHAR(50);
    RAISE NOTICE 'Added payment_method to invoices table';
  ELSE
    RAISE NOTICE 'payment_method already exists in invoices table';
  END IF;
END $$;

-- ============================================
-- 8. Add notes field to invoices
-- For internal notes or refund reasons
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'notes'
  ) THEN
    ALTER TABLE invoices ADD COLUMN notes TEXT;
    RAISE NOTICE 'Added notes to invoices table';
  ELSE
    RAISE NOTICE 'notes already exists in invoices table';
  END IF;
END $$;

-- ============================================
-- 9. Add parent_installment_id to installments
-- For refunds to track which installment was refunded
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'installments' AND column_name = 'parent_installment_id'
  ) THEN
    ALTER TABLE installments ADD COLUMN parent_installment_id UUID REFERENCES installments(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added parent_installment_id to installments table';
  ELSE
    RAISE NOTICE 'parent_installment_id already exists in installments table';
  END IF;
END $$;

-- ============================================
-- 10. Add refund_reason to installments
-- Store reason for refund
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'installments' AND column_name = 'refund_reason'
  ) THEN
    ALTER TABLE installments ADD COLUMN refund_reason TEXT;
    RAISE NOTICE 'Added refund_reason to installments table';
  ELSE
    RAISE NOTICE 'refund_reason already exists in installments table';
  END IF;
END $$;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON COLUMN clients.stripe_customer_id IS 'Stripe Customer ID - required for creating invoices in Stripe';
COMMENT ON COLUMN invoices.currency IS 'ISO 4217 currency code (e.g., pln, usd, eur)';
COMMENT ON COLUMN invoices.collection_method IS 'How to collect payment: send_invoice or charge_automatically';
COMMENT ON COLUMN invoices.stripe_hosted_invoice_url IS 'URL for customer to view and pay the invoice';
COMMENT ON COLUMN invoices.stripe_invoice_pdf IS 'URL to download PDF version of invoice';
COMMENT ON COLUMN invoices.voided_at IS 'Timestamp when invoice was voided/cancelled';
COMMENT ON COLUMN invoices.payment_method IS 'Payment method used: stripe, cash, bank_transfer, other';
COMMENT ON COLUMN invoices.notes IS 'Internal notes (e.g., refund reason)';
COMMENT ON COLUMN installments.parent_installment_id IS 'For refunds: references the original installment being refunded';
COMMENT ON COLUMN installments.refund_reason IS 'Reason for the refund';

-- ============================================
-- Summary of Status Mapping
-- ============================================
-- Our Status   -> Stripe Status
-- draft        -> draft
-- sent         -> open (finalized and awaiting payment)
-- viewed       -> open (customer viewed, still awaiting payment)
-- paid         -> paid
-- overdue      -> open (with past due_date)
-- cancelled    -> void
-- 
-- Note: Stripe also has 'uncollectible' for bad debt write-offs
-- ============================================