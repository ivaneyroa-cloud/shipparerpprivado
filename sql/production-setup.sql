-- ═══════════════════════════════════════════════════════════════
-- SHIPPAR ERP — PRODUCTION DATABASE SETUP
-- Run this ONCE before deploying to production.
-- Safe to re-run: uses IF NOT EXISTS everywhere.
-- ═══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 1. PERFORMANCE_EVENTS
--    Logs reception events, difference detections, etc.
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    event_type text NOT NULL,
    shipment_id uuid,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

ALTER TABLE performance_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "user_insert_own_events" ON performance_events
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "user_read_own_events" ON performance_events
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "admin_read_all_events" ON performance_events
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_perf_events_user ON performance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_events_type ON performance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_perf_events_created ON performance_events(created_at DESC);

-- ──────────────────────────────────────────────
-- 2. USER_DAILY_STATS
--    Daily aggregates: receptions, kg, active minutes
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_daily_stats (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    stat_date date NOT NULL DEFAULT CURRENT_DATE,
    receptions_count integer DEFAULT 0,
    kg_managed numeric DEFAULT 0,
    differences_detected integer DEFAULT 0,
    clean_receptions integer DEFAULT 0,
    total_receptions integer DEFAULT 0,
    avg_reception_seconds integer DEFAULT 0,
    active_minutes numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, stat_date)
);

ALTER TABLE user_daily_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "users_read_own_stats" ON user_daily_stats
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "users_insert_own_stats" ON user_daily_stats
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "users_update_own_stats" ON user_daily_stats
        FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "admin_read_all_stats" ON user_daily_stats
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON user_daily_stats(user_id, stat_date);

-- ──────────────────────────────────────────────
-- 3. USER_STREAKS
--    Gamification: consecutive day streaks
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_streaks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    current_streak integer DEFAULT 0,
    best_streak integer DEFAULT 0,
    last_active_date date,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "users_read_own_streak" ON user_streaks
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "users_upsert_own_streak" ON user_streaks
        FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────
-- 4. RECEPTION_VERSIONS
--    Versioned snapshots of each reception edit
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reception_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shipment_id uuid NOT NULL,
    version_number integer NOT NULL DEFAULT 1,
    payload_snapshot jsonb NOT NULL,
    created_by uuid,
    reason text,
    is_post_delivery boolean DEFAULT false,
    diff_summary jsonb,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE reception_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "authenticated_insert_versions" ON reception_versions
        FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "authenticated_read_versions" ON reception_versions
        FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_versions_shipment ON reception_versions(shipment_id);

-- ──────────────────────────────────────────────
-- 5. ACTIVITY_LOGS (audit trail)
--    Logs all sensitive actions for the audit system
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid,
    action text NOT NULL,
    details text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "authenticated_insert_logs" ON activity_logs
        FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "admin_read_logs" ON activity_logs
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "admin_delete_logs" ON activity_logs
        FOR DELETE USING (
            EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- ──────────────────────────────────────────────
-- 6. AUDIT_LOG (separate security audit table)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid,
    action text NOT NULL,
    table_name text,
    record_id uuid,
    old_data jsonb,
    new_data jsonb,
    ip_address text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "admin_read_audit" ON audit_log
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "service_insert_audit" ON audit_log
        FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ──────────────────────────────────────────────
-- 7. SHIPMENTS — Add columns if missing
--    (safe: uses exception handling)
-- ──────────────────────────────────────────────
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS reception_status text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delta_kg numeric DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delta_boxes integer DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS reception_version_count integer DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS current_version_id uuid; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS edited_post_delivery boolean DEFAULT false; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS peso_computable numeric DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS boxes_count integer DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS costo_flete numeric DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS retenido_nota text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS bultos jsonb; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS invoice_photo_1 text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shipments ADD COLUMN IF NOT EXISTS invoice_photo_2 text; EXCEPTION WHEN others THEN NULL; END $$;

-- ──────────────────────────────────────────────
-- 8. SHIPMENTS — Safety constraints
-- ──────────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE shipments ADD CONSTRAINT chk_weight_non_negative CHECK (weight >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE shipments ADD CONSTRAINT chk_peso_computable_non_negative CHECK (peso_computable >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────
-- 9. INDEXES for performance
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(internal_status);
CREATE INDEX IF NOT EXISTS idx_shipments_client ON shipments(client_id);
CREATE INDEX IF NOT EXISTS idx_shipments_created ON shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_updated ON shipments(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_date_arrived ON shipments(date_arrived);
CREATE INDEX IF NOT EXISTS idx_clients_assigned ON clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ═══════════════════════════════════════════════════════════════
-- DONE! All tables, RLS policies, indexes, and constraints
-- are now configured for production.
-- ═══════════════════════════════════════════════════════════════
