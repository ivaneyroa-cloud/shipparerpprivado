-- ========================================================
-- RECEPTION VERSIONING + AUDIT LOG + POST-DELIVERY PROTECTION
-- ========================================================

-- 1) reception_versions table
-- Every confirm/edit creates an immutable snapshot
CREATE TABLE IF NOT EXISTS reception_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    payload_snapshot JSONB NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT,  -- NULL for initial, required for edits
    is_post_delivery BOOLEAN DEFAULT FALSE,
    diff_summary JSONB  -- What changed vs previous version
);

CREATE INDEX IF NOT EXISTS idx_rv_shipment_id ON reception_versions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_rv_created_at ON reception_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rv_post_delivery ON reception_versions(is_post_delivery) WHERE is_post_delivery = TRUE;

-- RLS for reception_versions
ALTER TABLE reception_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read versions"
    ON reception_versions FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert versions"
    ON reception_versions FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 2) Add post-delivery edit tracking to shipments
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS edited_post_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES reception_versions(id);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS reception_version_count INTEGER DEFAULT 0;
