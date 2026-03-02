-- ═══════════════════════════════════════════════════════════════
-- SHIPPAR ERP — CLEAN ALL TEST DATA
-- Run this BEFORE going to production.
-- This removes ALL existing shipments and clients.
-- Your team will then upload real data via the import feature.
--
-- ⚠️ THIS IS DESTRUCTIVE — RUN ONLY ONCE BEFORE PRODUCTION
-- ═══════════════════════════════════════════════════════════════

-- 1. Delete all test shipments
-- (also clears related data in order)
DELETE FROM reception_versions;
DELETE FROM performance_events;
DELETE FROM activity_logs;
DELETE FROM audit_log;
DELETE FROM user_daily_stats;
DELETE FROM user_streaks;
DELETE FROM shipments;

-- 2. Delete all test clients
DELETE FROM clients;

-- 3. Reset invoices if any exist
DELETE FROM invoices;

-- 4. Delete all test user profiles
-- ⚠️ IMPORTANT: This deletes profiles but NOT auth users.
-- You MUST also go to Supabase Dashboard → Authentication → Users
-- and delete all test users manually. Then create your real users.
DELETE FROM profiles;

-- 5. Verify everything is clean
SELECT 'shipments' AS table_name, COUNT(*) AS remaining FROM shipments
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'reception_versions', COUNT(*) FROM reception_versions
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs;

-- ═══════════════════════════════════════════════════════════════
-- DONE! All test data has been removed.
-- 
-- NEXT STEPS:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Delete ALL test users manually
-- 3. Create your real admin user (sign up + set role = 'admin')
-- 4. Import real clients and shipments via the app
-- ═══════════════════════════════════════════════════════════════

