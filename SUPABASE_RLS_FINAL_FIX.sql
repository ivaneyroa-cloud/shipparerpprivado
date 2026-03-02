-- ========================================================
-- SHIPPAR: REPARACIÓN ATÓMICA GLOBAL DE RLS Y SEGURIDAD (V4)
-- ========================================================

-- 1. ASEGURAR ESTRUCTURA DE TABLAS (Sin fallos si ya existen)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'operator';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. LIMPIEZA DE POLÍTICAS ANTIGUAS (Nuclear: borra TODAS para empezar de cero)
DO $$ 
DECLARE pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'shipments' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.shipments';
    END LOOP;
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'clients' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.clients';
    END LOOP;
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.profiles';
    END LOOP;
END $$;

-- 3. FUNCIONES DE SEGURIDAD (En esquema PUBLIC para evitar errores de permisos)
CREATE OR REPLACE FUNCTION public.user_role() RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_org_id() RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. REPARACIÓN DE DATOS (Vital para que el RLS no bloquee)
-- 4.1. Si el usuario que ejecuta esto no tiene profile, lo creamos (si auth.uid() existe)
INSERT INTO public.profiles (id, full_name, role, org_id)
SELECT auth.uid(), 'Admin Principal', 'admin', gen_random_uuid()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET role = 'admin' WHERE profiles.role IS NULL;

-- 4.2. Asignar Org ID a perfiles que no tengan
UPDATE public.profiles SET org_id = gen_random_uuid() WHERE org_id IS NULL;

-- 4.3. Propagar Org ID a envíos y clientes huerfanos (usando la org del primer admin)
UPDATE public.shipments SET org_id = (SELECT org_id FROM public.profiles WHERE role = 'admin' LIMIT 1) WHERE org_id IS NULL;
UPDATE public.clients SET org_id = (SELECT org_id FROM public.profiles WHERE role = 'admin' LIMIT 1) WHERE org_id IS NULL;

-- 4.4. Vincular envíos con clientes por nombre
UPDATE public.shipments s SET client_id = c.id FROM public.clients c WHERE LOWER(s.client_name) = LOWER(c.name) AND s.client_id IS NULL;

-- 5. NUEVAS POLÍTICAS DE SEGURIDAD (Simples y robustas)

-- PROFILES: Lectura para todos los de la misma Org, full para admins
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_rule" ON public.profiles FOR ALL USING (
    id = auth.uid() OR public.user_org_id() = org_id OR public.user_role() = 'admin'
);

-- SHIPMENTS: Reglas por rol
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments_select" ON public.shipments FOR SELECT USING (
    public.user_role() IN ('admin', 'ops', 'logistics', 'billing', 'operator') OR
    (public.user_role() = 'sales' AND EXISTS (SELECT 1 FROM public.clients WHERE id = shipments.client_id AND assigned_to = auth.uid()))
);

CREATE POLICY "shipments_insert" ON public.shipments FOR INSERT WITH CHECK (
    public.user_role() IN ('admin', 'ops', 'logistics', 'sales', 'operator')
);

CREATE POLICY "shipments_update" ON public.shipments FOR UPDATE USING (
    public.user_role() IN ('admin', 'ops', 'logistics', 'billing', 'operator') OR
    (public.user_role() = 'sales' AND EXISTS (SELECT 1 FROM public.clients WHERE id = shipments.client_id AND assigned_to = auth.uid()))
);

CREATE POLICY "shipments_delete" ON public.shipments FOR DELETE USING (
    public.user_role() IN ('admin', 'ops', 'logistics')
);

-- CLIENTS: Reglas por rol
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_rule" ON public.clients FOR ALL USING (
    public.user_role() IN ('admin', 'ops', 'logistics', 'billing', 'operator') OR
    (public.user_role() = 'sales' AND assigned_to = auth.uid())
);

-- 6. PERMISOS EXTRA (Solo si es necesario para el editor SQL)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
