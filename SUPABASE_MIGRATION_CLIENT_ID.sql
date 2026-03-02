-- ==========================================
-- SHIPPAR: MIGRACIÓN A client_id (FK)
-- ==========================================
-- Objetivo: Dejar de filtrar por client_name (string frágil) 
-- y pasar a client_id (UUID, Foreign Key real).
-- Esto hace el sistema inmune a cambios de nombre, duplicados y typos.

-- 1. Agregar columna client_id a shipments (nullable al inicio para no romper datos existentes)
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 2. Poblar client_id usando client_name existente
-- Esto matchea cada envío con su cliente por nombre y le asigna el ID real
UPDATE public.shipments s
SET client_id = c.id
FROM public.clients c
WHERE s.client_name = c.name
  AND s.client_id IS NULL;

-- 3. Crear índice para performance en queries filtradas por client_id
CREATE INDEX IF NOT EXISTS idx_shipments_client_id ON public.shipments(client_id);

-- 4. Actualizar las políticas RLS para usar client_id en vez de client_name
-- Esto es más seguro y mucho más rápido (UUID join vs string comparison)

-- SELECT
DROP POLICY IF EXISTS "Users can view shipments based on role" ON public.shipments;
CREATE POLICY "Users can view shipments based on role"
ON public.shipments
FOR SELECT
USING (
  (get_current_user_role() IN ('admin', 'ops'))
  OR
  (get_current_user_role() = 'sales' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE id = shipments.client_id 
      AND assigned_to = auth.uid()
  ))
);

-- UPDATE
DROP POLICY IF EXISTS "Users can update shipments based on role" ON public.shipments;
CREATE POLICY "Users can update shipments based on role"
ON public.shipments
FOR UPDATE
USING (
  (get_current_user_role() IN ('admin', 'ops'))
  OR
  (get_current_user_role() = 'sales' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE id = shipments.client_id 
      AND assigned_to = auth.uid()
  ))
);

-- INSERT
DROP POLICY IF EXISTS "Users can insert shipments based on role" ON public.shipments;
CREATE POLICY "Users can insert shipments based on role"
ON public.shipments
FOR INSERT
WITH CHECK (
  (get_current_user_role() IN ('admin', 'ops'))
  OR
  (get_current_user_role() = 'sales' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE id = shipments.client_id 
      AND assigned_to = auth.uid()
  ))
);

-- DELETE (nuevo — antes no lo teníamos)
DROP POLICY IF EXISTS "Users can delete shipments based on role" ON public.shipments;
CREATE POLICY "Users can delete shipments based on role"
ON public.shipments
FOR DELETE
USING (
  (get_current_user_role() IN ('admin', 'ops'))
  OR
  (get_current_user_role() = 'sales' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE id = shipments.client_id 
      AND assigned_to = auth.uid()
  ))
);

-- ==========================================
-- VERIFICACIÓN: Ejecutá esto después para confirmar que todo migró bien
-- SELECT count(*) as total, count(client_id) as con_id, count(*) - count(client_id) as sin_id FROM shipments;
-- Si "sin_id" > 0, hay envíos con client_name que no matchea ningún cliente.
-- ==========================================
