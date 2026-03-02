-- ═══════════════════════════════════════════════════════════
-- SHIPPAR HARDENING MIGRATION — Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════
-- Date: 2026-02-26
-- SAFE TO RUN IN PRODUCTION — all operations are idempotent
-- ═══════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────────────────┐
-- │  1. AUDIT LOG TABLE                                      │
-- └──────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    actor_email TEXT,
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at DESC);

-- RLS: only admins can read, nobody can write from client
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Admins read audit" ON audit_log;

CREATE POLICY "Admins read audit"
    ON audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );
-- No INSERT/UPDATE/DELETE policies — only service role can write


-- ┌──────────────────────────────────────────────────────────┐
-- │  2. PERFORMANCE INDEXES                                  │
-- └──────────────────────────────────────────────────────────┘

-- Composite: org queries + date filtering (most common pattern)
CREATE INDEX IF NOT EXISTS idx_shipments_org_created
    ON shipments(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipments_org_status
    ON shipments(org_id, internal_status);

CREATE INDEX IF NOT EXISTS idx_shipments_org_updated
    ON shipments(org_id, updated_at DESC);

-- Client lookups
CREATE INDEX IF NOT EXISTS idx_clients_org_name
    ON clients(org_id, name);

CREATE INDEX IF NOT EXISTS idx_clients_assigned_to
    ON clients(assigned_to);

-- Cobranzas queries
CREATE INDEX IF NOT EXISTS idx_shipments_estado_cobranza
    ON shipments(estado_cobranza, updated_at DESC);

-- Provider payments
CREATE INDEX IF NOT EXISTS idx_shipments_pago_proveedor
    ON shipments(estado_pago_proveedor);

-- Profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_org_role
    ON profiles(org_id, role);

-- Team messages (chat polling)
CREATE INDEX IF NOT EXISTS idx_team_messages_created
    ON team_messages(created_at DESC);


-- ┌──────────────────────────────────────────────────────────┐
-- │  3. CHECK CONSTRAINTS                                    │
-- └──────────────────────────────────────────────────────────┘

-- Role enum check
DO $$ BEGIN
    ALTER TABLE profiles ADD CONSTRAINT chk_profiles_role
        CHECK (role IN ('admin', 'logistics', 'sales', 'billing', 'operator'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Positive weight
DO $$ BEGIN
    ALTER TABLE shipments ADD CONSTRAINT chk_shipments_weight_positive
        CHECK (weight IS NULL OR weight >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Positive monetary values
DO $$ BEGIN
    ALTER TABLE shipments ADD CONSTRAINT chk_shipments_precio_positive
        CHECK (precio_envio IS NULL OR precio_envio >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE shipments ADD CONSTRAINT chk_shipments_costo_positive
        CHECK (costo_flete IS NULL OR costo_flete >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ┌──────────────────────────────────────────────────────────┐
-- │  4. SUPER ADMIN COLUMN                                   │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Set the current super admin
UPDATE profiles SET is_super_admin = true WHERE email = 'ivaneyroa@shippar.net';


-- ┌──────────────────────────────────────────────────────────┐
-- │  5. CLIENT CODE SEQUENCE (race condition fix)            │
-- └──────────────────────────────────────────────────────────┘

CREATE SEQUENCE IF NOT EXISTS client_code_seq START WITH 1;

-- Initialize the sequence from the last existing value
DO $$
DECLARE max_code INTEGER;
BEGIN
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(code FROM 'SH-(\d+)') AS INTEGER)), 0
    ) INTO max_code FROM clients WHERE code ~ '^SH-\d+$';
    PERFORM setval('client_code_seq', GREATEST(max_code, 1));
END $$;

-- Trigger that auto-generates the code on INSERT if not provided
CREATE OR REPLACE FUNCTION auto_client_code()
RETURNS TRIGGER AS $$
DECLARE
    next_val INTEGER;
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        SELECT nextval('client_code_seq') INTO next_val;
        NEW.code := 'SH-' || LPAD(next_val::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_client_code ON clients;
CREATE TRIGGER trg_auto_client_code
    BEFORE INSERT ON clients
    FOR EACH ROW
    EXECUTE FUNCTION auto_client_code();


-- ┌──────────────────────────────────────────────────────────┐
-- │  6. IMMUTABLE ORG_ID TRIGGER                             │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION prevent_org_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.org_id IS NOT NULL AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
        RAISE EXCEPTION 'org_id is immutable once set';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_org_change_shipments ON shipments;
CREATE TRIGGER trg_prevent_org_change_shipments
    BEFORE UPDATE ON shipments FOR EACH ROW
    EXECUTE FUNCTION prevent_org_change();

DROP TRIGGER IF EXISTS trg_prevent_org_change_clients ON clients;
CREATE TRIGGER trg_prevent_org_change_clients
    BEFORE UPDATE ON clients FOR EACH ROW
    EXECUTE FUNCTION prevent_org_change();

DROP TRIGGER IF EXISTS trg_prevent_org_change_profiles ON profiles;
CREATE TRIGGER trg_prevent_org_change_profiles
    BEFORE UPDATE ON profiles FOR EACH ROW
    EXECUTE FUNCTION prevent_org_change();


-- ┌──────────────────────────────────────────────────────────┐
-- │  7. AUTO UPDATED_AT TRIGGER                              │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION auto_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_updated_shipments ON shipments;
CREATE TRIGGER trg_auto_updated_shipments
    BEFORE UPDATE ON shipments FOR EACH ROW
    EXECUTE FUNCTION auto_updated_at();


-- ┌──────────────────────────────────────────────────────────┐
-- │  DONE — Verify with:                                     │
-- │                                                          │
-- │  SELECT tablename, rowsecurity FROM pg_tables            │
-- │  WHERE schemaname = 'public';                            │
-- │                                                          │
-- │  SELECT * FROM audit_log LIMIT 5;                        │
-- └──────────────────────────────────────────────────────────┘
