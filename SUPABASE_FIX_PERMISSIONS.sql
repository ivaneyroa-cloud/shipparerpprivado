-- ================================================================
-- SHIPPAR: PRODUCTION-GRADE PERMISSIONS + RLS — Final-v6
-- Safe to re-run from Supabase SQL Editor.
-- NOTE: If you have other RPCs in public schema, add GRANT EXECUTE
--       for them below (search "Add your other RPCs here").
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- STEP 0: Ensure schema columns exist (idempotent, safe on fresh DB)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS org_id      UUID;
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS role         TEXT DEFAULT 'sales';
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS full_name    TEXT;

ALTER TABLE public.clients   ADD COLUMN IF NOT EXISTS org_id       UUID;
ALTER TABLE public.clients   ADD COLUMN IF NOT EXISTS assigned_to  UUID REFERENCES auth.users(id);
ALTER TABLE public.clients   ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS org_id       UUID;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS client_id    UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────────
-- STEP 1: Extensions
-- ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────────
-- STEP 2: Core security functions
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ────────────────────────────────────────────────────────────────
-- STEP 3: Admin RPC — only safe way to change roles
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.user_role() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Access denied: only admins can change roles';
    END IF;

    IF p_role NOT IN ('admin', 'logistics', 'billing', 'operator', 'sales') THEN
        RAISE EXCEPTION 'Invalid role: %. Valid: admin, logistics, billing, operator, sales', p_role;
    END IF;

    -- Prevent admin from accidentally demoting themselves
    IF p_user_id = auth.uid() AND p_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Cannot demote yourself. Ask another admin.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id
          AND org_id = public.user_org_id()
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'User not found, not in your org, or already deleted';
    END IF;

    UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- STEP 4: Soft-delete RPCs (replaces physical DELETE)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_shipment(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.user_role() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Access denied: only admins can delete shipments';
    END IF;
    UPDATE public.shipments
    SET deleted_at = now()
    WHERE id = p_id AND org_id = public.user_org_id() AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shipment not found, not in your org, or already deleted';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_client(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.user_role() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Access denied: only admins can delete clients';
    END IF;
    UPDATE public.clients
    SET deleted_at = now()
    WHERE id = p_id AND org_id = public.user_org_id() AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client not found, not in your org, or already deleted';
    END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- STEP 5: REVOKE — tables + explicit function revoke from PUBLIC/anon
-- Postgres grants EXECUTE to PUBLIC by default on new functions.
-- We don't do REVOKE ON ALL FUNCTIONS (would break Supabase internals),
-- but we do revoke explicitly for each function we own.
-- ────────────────────────────────────────────────────────────────
REVOKE ALL ON public.shipments FROM anon, authenticated, public;
REVOKE ALL ON public.clients   FROM anon, authenticated, public;
REVOKE ALL ON public.profiles  FROM anon, authenticated, public;

-- Revoke EXECUTE from PUBLIC/anon on our functions (strips the default grant)
-- Note: set_org_id_on_insert() is revoked below, after it is created.
REVOKE EXECUTE ON FUNCTION public.user_role()                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_org_id()                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_shipment(UUID)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_client(UUID)        FROM PUBLIC, anon;

-- ────────────────────────────────────────────────────────────────
-- STEP 6: Minimal grants (authenticated only)
-- ────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.shipments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.clients   TO authenticated;
GRANT SELECT                 ON public.profiles  TO authenticated;
-- profiles: only safe columns are writable (not role, not org_id)
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
-- Note: email intentionally excluded — mirror auth.users.email server-side.

-- Explicit function whitelist (back to authenticated only)
GRANT EXECUTE ON FUNCTION public.user_role()                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org_id()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_shipment(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_client(UUID)          TO authenticated;
-- Add your other RPCs here:
-- GRANT EXECUTE ON FUNCTION public.your_rpc_name(...) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- STEP 7: Enable + FORCE RLS (prevents accidental bypass by owner)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
-- FORCE RLS is applied at the end (Step 16), after all policies exist.
-- Applying it now with no policies would block even the owner during backfill.

-- ────────────────────────────────────────────────────────────────
-- STEP 8: Backfill NULL org_ids
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_admin_id UUID;
    v_org      UUID;
BEGIN
    SELECT id INTO v_admin_id FROM public.profiles
    WHERE deleted_at IS NULL
    ORDER BY (CASE WHEN role = 'admin' THEN 0 ELSE 1 END), id ASC LIMIT 1;

    IF v_admin_id IS NULL THEN
        SELECT id INTO v_admin_id FROM auth.users ORDER BY id ASC LIMIT 1;
    END IF;

    IF v_admin_id IS NULL THEN
        RAISE NOTICE 'No users found — skipping backfill.';
        RETURN;
    END IF;

    SELECT org_id INTO v_org FROM public.profiles WHERE id = v_admin_id;
    IF v_org IS NULL THEN
        v_org := gen_random_uuid();
        UPDATE public.profiles SET org_id = v_org, role = 'admin' WHERE id = v_admin_id;
    END IF;

    UPDATE public.shipments SET org_id = v_org WHERE org_id IS NULL;
    UPDATE public.clients   SET org_id = v_org WHERE org_id IS NULL;
    UPDATE public.profiles  SET org_id = v_org WHERE org_id IS NULL AND id != v_admin_id;

    -- Backfill NULL roles (prevents users from being locked out of all policies)
    UPDATE public.profiles SET role = 'sales' WHERE role IS NULL AND deleted_at IS NULL;
    -- Always ensure the detected admin stays admin
    UPDATE public.profiles SET role = 'admin' WHERE id = v_admin_id;

    RAISE NOTICE '✅ Backfill done → org_id = %', v_org;
END $$;

-- ────────────────────────────────────────────────────────────────
-- STEP 9: Assert zero NULLs before enforcing NOT NULL column
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.shipments WHERE org_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot enforce NOT NULL: shipments still has NULL org_id rows';
    END IF;
    IF EXISTS (SELECT 1 FROM public.clients WHERE org_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot enforce NOT NULL: clients still has NULL org_id rows';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE org_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot enforce NOT NULL: profiles still has NULL org_id rows';
    END IF;
END $$;

ALTER TABLE public.shipments ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.clients   ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.profiles  ALTER COLUMN org_id SET NOT NULL;

-- ⚠️  IMPORTANT: If you have a handle_new_user trigger that creates profiles
-- on signup, make sure it assigns org_id, e.g.:
--   NEW.org_id = (SELECT id FROM public.orgs LIMIT 1);
--   NEW.role   = 'sales';
-- If it doesn't, new user signups will fail with NOT NULL violation.

-- ────────────────────────────────────────────────────────────────
-- STEP 10: Auto-assign org_id trigger (belt-and-suspenders)
-- Column is NOT NULL, but trigger catches any app-level omission
-- before the DB constraint fires.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_org_id_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.org_id IS NULL THEN
        NEW.org_id := public.user_org_id();
    END IF;
    IF NEW.org_id IS NULL THEN
        RAISE EXCEPTION 'org_id is required — user has no org assigned (check profiles table)';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_org_id ON public.shipments;
CREATE TRIGGER trg_set_org_id
    BEFORE INSERT ON public.shipments
    FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_org_id_clients ON public.clients;
CREATE TRIGGER trg_set_org_id_clients
    BEFORE INSERT ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();

-- Deferred REVOKE: set_org_id_on_insert now exists, safe to revoke from PUBLIC/anon
DO $$
BEGIN
    IF to_regprocedure('public.set_org_id_on_insert()') IS NOT NULL THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_org_id_on_insert() FROM PUBLIC, anon';
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- STEP 11: Performance indexes
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shipments_org_client ON public.shipments(org_id, client_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_assigned  ON public.clients(org_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_profiles_id_org       ON public.profiles(id, org_id);

-- ────────────────────────────────────────────────────────────────
-- STEP 12: Drop all existing policies (clean slate)
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD; tab TEXT;
BEGIN
    FOREACH tab IN ARRAY ARRAY['shipments', 'clients', 'profiles'] LOOP
        FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = tab AND schemaname = 'public') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tab);
        END LOOP;
    END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────
-- STEP 13: SHIPMENTS policies
-- INSERT: org_id is sent by app (frontend always includes it).
--         Trigger is a safety net if app forgets.
-- No DELETE policy: physical deletes are blocked. Use soft_delete_shipment().
-- ────────────────────────────────────────────────────────────────
CREATE POLICY "shipments_select" ON public.shipments
FOR SELECT USING (
    org_id = public.user_org_id()
    AND deleted_at IS NULL
    AND (
        public.user_role() IN ('admin', 'logistics', 'billing', 'operator')
        OR (
            public.user_role() = 'sales'
            AND client_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.clients
                WHERE id = shipments.client_id AND assigned_to = auth.uid()
            )
        )
    )
);

CREATE POLICY "shipments_insert" ON public.shipments
FOR INSERT WITH CHECK (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'logistics', 'sales', 'operator')
);

CREATE POLICY "shipments_update" ON public.shipments
FOR UPDATE USING (
    org_id = public.user_org_id()
    AND deleted_at IS NULL
    AND (
        public.user_role() IN ('admin', 'logistics', 'billing', 'operator')
        OR (
            public.user_role() = 'sales'
            AND client_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.clients
                WHERE id = shipments.client_id AND assigned_to = auth.uid()
            )
        )
    )
) WITH CHECK (org_id = public.user_org_id());

-- ────────────────────────────────────────────────────────────────
-- STEP 14: CLIENTS policies
-- ────────────────────────────────────────────────────────────────
CREATE POLICY "clients_select" ON public.clients
FOR SELECT USING (
    org_id = public.user_org_id()
    AND deleted_at IS NULL
    AND (
        public.user_role() IN ('admin', 'logistics', 'billing', 'operator')
        OR (public.user_role() = 'sales' AND assigned_to = auth.uid())
    )
);

CREATE POLICY "clients_insert" ON public.clients
FOR INSERT WITH CHECK (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'sales', 'operator')
);

CREATE POLICY "clients_update" ON public.clients
FOR UPDATE USING (
    org_id = public.user_org_id()
    AND deleted_at IS NULL
    AND (
        public.user_role() IN ('admin', 'logistics', 'operator')
        OR (public.user_role() = 'sales' AND assigned_to = auth.uid())
    )
) WITH CHECK (org_id = public.user_org_id());

-- ────────────────────────────────────────────────────────────────
-- STEP 15: PROFILES policies
-- ────────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT USING (
    id = auth.uid()
    OR (org_id = public.user_org_id() AND public.user_role() = 'admin')
);

-- UPDATE uses column-level GRANT (only full_name) as the real guard.
-- WITH CHECK just ensures you can't switch to someone else's row.
CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ────────────────────────────────────────────────────────────────
-- STEP 16: Role CHECK constraint (table-level guard against invalid roles)
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('admin', 'logistics', 'billing', 'operator', 'sales'));
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- STEP 17: FORCE RLS (now safe — all policies exist above)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.shipments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clients   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles  FORCE ROW LEVEL SECURITY;
