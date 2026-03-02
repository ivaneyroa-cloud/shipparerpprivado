-- ==========================================
-- SHIPPAR: REPARACIÓN DE RLS Y ROLES
-- ==========================================

-- 0. Asegurar que las columnas bases existen en todas las tablas
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'read';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 1. Crear funciones de seguridad en el esquema PUBLIC
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Corregir políticas de shipments para usar las nuevas funciones y matchear roles del frontend
-- Roles permitidos en el front: ['admin','logistics','sales','billing']

-- SELECT POLICY
DROP POLICY IF EXISTS "Users can view shipments based on role" ON public.shipments;
DROP POLICY IF EXISTS "shipments_read_policy" ON public.shipments;
DROP POLICY IF EXISTS "shipments_read_policy_v2" ON public.shipments;

CREATE POLICY "shipments_read_policy_v3"
ON public.shipments
FOR SELECT
USING (
  (public.user_role() IN ('admin', 'ops', 'logistics', 'billing'))
  OR
  (public.user_role() = 'sales' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE id = shipments.client_id 
      AND assigned_to = auth.uid()
  ))
  OR
  (client_id IS NULL AND public.user_role() = 'sales')
);

-- UPDATE POLICY
DROP POLICY IF EXISTS "Users can update shipments based on role" ON public.shipments;
DROP POLICY IF EXISTS "shipments_update_policy" ON public.shipments;
DROP POLICY IF EXISTS "shipments_update_policy_v2" ON public.shipments;

CREATE POLICY "shipments_update_policy_v3"
ON public.shipments
FOR UPDATE
USING (
  (public.user_role() IN ('admin', 'ops', 'logistics', 'billing'))
  OR
  (public.user_role() = 'sales' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE id = shipments.client_id 
      AND assigned_to = auth.uid()
  ))
);

-- INSERT POLICY
DROP POLICY IF EXISTS "Users can insert shipments based on role" ON public.shipments;
DROP POLICY IF EXISTS "shipments_insert_policy" ON public.shipments;
DROP POLICY IF EXISTS "shipments_insert_policy_v2" ON public.shipments;

CREATE POLICY "shipments_insert_policy_v3"
ON public.shipments
FOR INSERT
WITH CHECK (
  (public.user_role() IN ('admin', 'ops', 'logistics', 'sales'))
);

-- DELETE POLICY
DROP POLICY IF EXISTS "Users can delete shipments based on role" ON public.shipments;
DROP POLICY IF EXISTS "shipments_delete_policy" ON public.shipments;
DROP POLICY IF EXISTS "shipments_delete_policy_v2" ON public.shipments;

CREATE POLICY "shipments_delete_policy_v3"
ON public.shipments
FOR DELETE
USING (
  (public.user_role() IN ('admin', 'ops', 'logistics'))
);

-- 3. FIX DATA: Asegurar consistencia de Organizaciones (Multi-tenant)
-- Si el usuario actual no tiene org_id, le asignamos uno nuevo para que pueda ver los datos
UPDATE public.profiles SET org_id = gen_random_uuid() WHERE id = auth.uid() AND org_id IS NULL;

-- Asignamos el org_id del usuario actual a todos los envíos y clientes que no tengan uno
UPDATE public.shipments SET org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()) WHERE org_id IS NULL;
UPDATE public.clients SET org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()) WHERE org_id IS NULL;

-- 4. FIX DATA: Vincular envíos con clientes (client_id)
UPDATE public.shipments s
SET client_id = c.id
FROM public.clients c
WHERE LOWER(s.client_name) = LOWER(c.name)
  AND s.client_id IS NULL;
