-- Migration 22: Add auto_send_date to installments
-- This allows scheduling automatic invoice sending on a specific date

-- Add auto_send_date column
ALTER TABLE installments 
ADD COLUMN IF NOT EXISTS auto_send_date DATE;

-- Add index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_installments_auto_send 
ON installments(auto_send_date) 
WHERE auto_send_date IS NOT NULL AND paid = false;

-- Update existing rows: if automatic_invoice is true, set auto_send_date to due_date
UPDATE installments 
SET auto_send_date = due_date 
WHERE automatic_invoice = true AND due_date IS NOT NULL AND auto_send_date IS NULL;

COMMENT ON COLUMN installments.auto_send_date IS 'Date when invoice should be automatically sent. NULL means manual sending only.';
