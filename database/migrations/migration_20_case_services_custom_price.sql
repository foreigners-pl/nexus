-- Migration 20: Add custom_price to case_services
-- This allows storing custom prices for services with "individual pricing"

-- Add custom_price column to case_services
ALTER TABLE case_services
ADD COLUMN IF NOT EXISTS custom_price DECIMAL(10, 2);

-- Add created_at for tracking
ALTER TABLE case_services
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN case_services.custom_price IS 'Custom price for services with individual pricing';