-- ========================================================
-- SHIPPAR: FIX UPDATE PERMISSIONS (org_id backfill + policy)
-- ========================================================
-- Run this in Supabase SQL Editor.
-- This script fixes the "Error al actualizar envío" caused by
-- shipments having NULL org_id while RLS requires org_id match.

-- STEP 1: Auto-detect the admin user and backfill all NULL org_id rows
-- No manual UUID needed — the script finds the first user in profiles automatically.
DO $$
DECLARE 
    admin_id UUID;
    target_org UUID;
BEGIN
    -- Auto-detect: pick the first profile that already has a role (preferring 'admin')
    SELECT id INTO admin_id FROM public.profiles ORDER BY (CASE WHEN role = 'admin' THEN 0 ELSE 1 END), created_at ASC LIMIT 1;
    
    IF admin_id IS NULL THEN
        -- Fallback: pick any user from auth.users
        SELECT id INTO admin_id FROM auth.users LIMIT 1;
    END IF;

    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'No users found in the system. Please create at least one user first.';
    END IF;

    RAISE NOTICE 'Using user % as admin for org backfill', admin_id;

    -- Get or create the admin's org_id
    SELECT org_id INTO target_org FROM public.profiles WHERE id = admin_id;
    
    IF target_org IS NULL THEN
        target_org := gen_random_uuid();
        UPDATE public.profiles SET org_id = target_org, role = 'admin' WHERE id = admin_id;
        RAISE NOTICE 'Created new org_id: %', target_org;
    END IF;

    -- Backfill ALL orphaned rows
    UPDATE public.shipments SET org_id = target_org WHERE org_id IS NULL;
    UPDATE public.clients SET org_id = target_org WHERE org_id IS NULL;
    UPDATE public.profiles SET org_id = target_org WHERE org_id IS NULL AND id != admin_id;
    
    RAISE NOTICE '✅ Backfill complete. All NULL org_ids set to: %', target_org;
END $$;


-- STEP 2: Recreate the shipments update policy to also handle legacy NULL org_id rows
-- This is a safety net — after the backfill above, there shouldn't be NULLs,
-- but this ensures no data is ever "stuck" again.
DROP POLICY IF EXISTS "shipments_update_policy" ON public.shipments;

CREATE POLICY "shipments_update_policy" ON public.shipments
FOR UPDATE USING (
    deleted_at IS NULL
    AND (
        -- Normal org isolation
        org_id = public.user_org_id()
        -- Safety net: allow updating rows with NULL org_id (legacy)
        OR org_id IS NULL
    )
    AND (
        public.user_role() IN ('admin', 'ops', 'logistics', 'billing', 'operator')
        OR (public.user_role() = 'sales' AND EXISTS (
            SELECT 1 FROM public.clients 
            WHERE id = shipments.client_id 
            AND assigned_to = auth.uid()
        ))
    )
) WITH CHECK (
    org_id = public.user_org_id() 
    OR org_id IS NULL
);

-- STEP 3: Do the same for SELECT (so legacy rows are visible)
DROP POLICY IF EXISTS "shipments_select_policy" ON public.shipments;

CREATE POLICY "shipments_select_policy" ON public.shipments
FOR SELECT USING (
    deleted_at IS NULL
    AND (
        org_id = public.user_org_id()
        OR org_id IS NULL
    )
    AND (
        public.user_role() IN ('admin', 'ops', 'logistics', 'billing', 'operator')
        OR (public.user_role() = 'sales' AND EXISTS (
            SELECT 1 FROM public.clients 
            WHERE id = shipments.client_id 
            AND assigned_to = auth.uid()
        ))
    )
);

-- STEP 4: Fix INSERT to auto-assign org_id via trigger
CREATE OR REPLACE FUNCTION public.set_org_id_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.org_id IS NULL THEN
        NEW.org_id := public.user_org_id();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_org_id ON public.shipments;
CREATE TRIGGER trg_set_org_id
    BEFORE INSERT ON public.shipments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_org_id_on_insert();

-- Also for clients
DROP TRIGGER IF EXISTS trg_set_org_id_clients ON public.clients;
CREATE TRIGGER trg_set_org_id_clients
    BEFORE INSERT ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.set_org_id_on_insert();

-- Fix INSERT policy to be more permissive (trigger handles org_id)
DROP POLICY IF EXISTS "shipments_insert_policy" ON public.shipments;

CREATE POLICY "shipments_insert_policy" ON public.shipments
FOR INSERT WITH CHECK (
    public.user_role() IN ('admin', 'ops', 'logistics', 'sales', 'operator')
);
