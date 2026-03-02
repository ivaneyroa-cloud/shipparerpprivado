-- ========================================================
-- ADD RECEPTION STATUS FIELDS TO SHIPMENTS TABLE
-- Tracks partial vs complete reception of packages
-- ========================================================

-- Reception status: PENDING (not received yet), PARTIAL (some boxes), COMPLETE (all boxes)
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS reception_status TEXT DEFAULT 'PENDING';

-- Delta tracking: difference between declared and received
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delta_kg NUMERIC DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delta_boxes INTEGER DEFAULT 0;

-- Index for quick filtering of partial receptions
CREATE INDEX IF NOT EXISTS idx_shipments_reception_status ON public.shipments(reception_status);

-- Backfill: mark already-received shipments as COMPLETE
-- Uses text cast to avoid enum type errors
UPDATE public.shipments
SET reception_status = 'COMPLETE'
WHERE internal_status::text IN ('Recibido en Oficina', 'Retirado', 'Despachado', 'Mercado Libre full')
  AND reception_status = 'PENDING'
  AND bultos IS NOT NULL;
