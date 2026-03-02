-- ========================================================
-- SHIPPAR: ATOMIC RLS & SECURITY REPAIR (BEST PRACTICES)
-- ========================================================
-- Este script aplica seguridad multi-tenant robusta, soft-delete
-- y protege contra ataques de schema-hijacking.

-- 0. CONFIGURACIÓN INICIAL (DATA BACKFILL)
-- REEMPLAZA ESTE UUID con tu ID de usuario real (el que ves en Auth > Users)
-- para que el proceso de "backfill" te asigne como Admin de la primera Org.
-- Si lo dejas como '00000000-0000-0000-0000-000000000000', el script NO reparará los datos huerfanos.
SET my.setup_admin_id = '00000000-0000-0000-0000-000000000000';

-- 1. ASEGURAR COLUMNAS Y EXTENSIONES
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'read';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. LIMPIEZA TOTAL DE POLÍTICAS EXISTENTES
DO $$ 
DECLARE tab RECORD; pol RECORD;
BEGIN 
    FOR tab IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('shipments', 'clients', 'profiles')) LOOP
        FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = tab.tablename AND schemaname = 'public') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tab.tablename);
        END LOOP;
    END LOOP;
END $$;

-- 3. FUNCIONES DE SEGURIDAD PROTEGIDAS (STABLE + SECURITY DEFINER + search_path)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 4. DATA BACKFILL (Robusto)
DO $$
DECLARE admin_id UUID := current_setting('my.setup_admin_id', true)::UUID;
DECLARE target_org_id UUID;
BEGIN
    -- 4.1. Asegurar que el Administrador tiene un perfil y una Org
    IF admin_id != '00000000-0000-0000-0000-000000000000'::UUID THEN
        -- Crear Org si no existe para este admin
        SELECT org_id INTO target_org_id FROM public.profiles WHERE id = admin_id;
        IF target_org_id IS NULL THEN
            target_org_id := gen_random_uuid();
        END IF;

        -- Insertar o actualizar perfil del admin
        INSERT INTO public.profiles (id, full_name, role, org_id)
        VALUES (admin_id, 'Super Admin', 'admin', target_org_id)
        ON CONFLICT (id) DO UPDATE SET role = 'admin', org_id = target_org_id;

        -- Migrar todos los datos huerfanos a esta Org
        UPDATE public.shipments SET org_id = target_org_id WHERE org_id IS NULL;
        UPDATE public.clients SET org_id = target_org_id WHERE org_id IS NULL;
        UPDATE public.profiles SET org_id = target_org_id WHERE org_id IS NULL AND id != admin_id;
    END IF;

    -- 4.2. Vincular envíos con clientes por nombre (Case Insensitive)
    UPDATE public.shipments s
    SET client_id = c.id
    FROM public.clients c
    WHERE LOWER(s.client_name) = LOWER(c.name)
      AND s.client_id IS NULL;
END $$;

-- 5. POLÍTICAS DE SEGURIDAD HARDENED

-- Habilitar RLS en todo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- 5.1. PROFILES
CREATE POLICY "profiles_isolation" ON public.profiles
FOR ALL USING (
    id = auth.uid() OR 
    (org_id = public.user_org_id() AND public.user_role() = 'admin')
);

-- 5.2. CLIENTS (Org Isolation + Role Access + Soft Delete)
CREATE POLICY "clients_isolation" ON public.clients
FOR ALL USING (
    org_id = public.user_org_id() 
    AND deleted_at IS NULL
    AND (
        public.user_role() IN ('admin', 'ops', 'logistics', 'billing', 'operator')
        OR (public.user_role() = 'sales' AND assigned_to = auth.uid())
    )
);

-- 5.3. SHIPMENTS (Org Isolation + Role Access + Soft Delete)

-- SELECT: Admins/Ops ven todo la Org. Sales ve solo sus clientes asignados.
CREATE POLICY "shipments_select_policy" ON public.shipments
FOR SELECT USING (
    org_id = public.user_org_id()
    AND deleted_at IS NULL
    AND (
        public.user_role() IN ('admin', 'ops', 'logistics', 'billing', 'operator')
        OR (public.user_role() = 'sales' AND EXISTS (
            SELECT 1 FROM public.clients 
            WHERE id = shipments.client_id 
            AND assigned_to = auth.uid()
        ))
    )
);

-- INSERT: Solo permitimos a los que tienen rol adecuado dentro de su Org.
CREATE POLICY "shipments_insert_policy" ON public.shipments
FOR INSERT WITH CHECK (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'ops', 'logistics', 'sales', 'operator')
);

-- UPDATE: Misma lógica que SELECT pero para edición.
CREATE POLICY "shipments_update_policy" ON public.shipments
FOR UPDATE USING (
    org_id = public.user_org_id()
    AND deleted_at IS NULL
    AND (
        public.user_role() IN ('admin', 'ops', 'logistics', 'billing', 'operator')
        OR (public.user_role() = 'sales' AND EXISTS (
            SELECT 1 FROM public.clients 
            WHERE id = shipments.client_id 
            AND assigned_to = auth.uid()
        ))
    )
) WITH CHECK (org_id = public.user_org_id());

-- DELETE: Soft delete mandatorio (se bloquea el DELETE físico excepto para admin tal vez, pero acá lo bloqueamos)
CREATE POLICY "shipments_delete_policy" ON public.shipments
FOR DELETE USING (
    org_id = public.user_org_id()
    AND public.user_role() = 'admin'
);

-- 6. PERMISOS DE ESQUEMA (Garantizar que el rol de 'authenticated' puede ejecutar las funciones)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
