-- ========================================================
-- ADD date_dispatched COLUMN TO shipments TABLE
-- This column tracks when a shipment was dispatched/picked up
-- from the depot (marked as Retirado, Despachado, or ML/Full)
-- ========================================================

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS date_dispatched DATE;

-- Create index for date range queries on dispatched date
CREATE INDEX IF NOT EXISTS idx_shipments_date_dispatched ON public.shipments(date_dispatched);
