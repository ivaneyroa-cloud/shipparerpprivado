-- Add missing payment columns to shipments table
-- These are required by the cobranzas page
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS payment_notes TEXT;
