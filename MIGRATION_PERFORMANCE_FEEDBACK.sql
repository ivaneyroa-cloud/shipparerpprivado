-- ══════════════════════════════════════════════════════════════
-- PERFORMANCE FEEDBACK LAYER — Data Model
-- ══════════════════════════════════════════════════════════════

-- 1) Performance Events Log
CREATE TABLE IF NOT EXISTS performance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    event_type TEXT NOT NULL, -- reception_confirmed, difference_detected, post_edit_detected, validation_error, streak_reset, record_broken
    shipment_id UUID REFERENCES shipments(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_perf_events_user ON performance_events(user_id);
CREATE INDEX idx_perf_events_type ON performance_events(event_type);
CREATE INDEX idx_perf_events_created ON performance_events(created_at);

-- 2) User Daily Stats (aggregated per user per day)
CREATE TABLE IF NOT EXISTS user_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receptions_count INT DEFAULT 0,
    kg_managed NUMERIC(10,2) DEFAULT 0,
    differences_detected INT DEFAULT 0,
    validation_errors INT DEFAULT 0,
    avg_reception_seconds INT DEFAULT 0,
    clean_receptions INT DEFAULT 0, -- no validation errors
    total_receptions INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, stat_date)
);

CREATE INDEX idx_daily_stats_user_date ON user_daily_stats(user_id, stat_date);

-- 3) User Streaks
CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
    current_clean_days INT DEFAULT 0,     -- consecutive days without validation errors
    current_clean_receptions INT DEFAULT 0, -- consecutive receptions without post-edit
    best_clean_days INT DEFAULT 0,
    best_clean_receptions INT DEFAULT 0,
    last_error_at TIMESTAMPTZ,
    last_edit_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_streaks_user ON user_streaks(user_id);

-- 4) Team Records (for record-level celebrations)
CREATE TABLE IF NOT EXISTS team_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_type TEXT NOT NULL, -- weekly_kg, daily_team_receptions, clean_week
    record_value NUMERIC(10,2) DEFAULT 0,
    achieved_by UUID REFERENCES auth.users(id),
    achieved_at TIMESTAMPTZ DEFAULT now(),
    period_start DATE,
    period_end DATE
);

-- RLS Policies
ALTER TABLE performance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_records ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own events and stats
CREATE POLICY "Users manage own performance_events"
    ON performance_events FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users manage own daily_stats"
    ON user_daily_stats FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users manage own streaks"
    ON user_streaks FOR ALL
    USING (auth.uid() = user_id);

-- Admins can read all
CREATE POLICY "Admins read all performance_events"
    ON performance_events FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins read all daily_stats"
    ON user_daily_stats FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins read all streaks"
    ON user_streaks FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Team records readable by all authenticated
CREATE POLICY "Authenticated read team_records"
    ON team_records FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users insert team_records"
    ON team_records FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
