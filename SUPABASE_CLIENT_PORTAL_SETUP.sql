-- ============================================================
-- SHIPPAR: CONFIGURACIÓN DEL PORTAL DE CLIENTES (SaaS)
-- ============================================================

-- 1. Vincular Clientes con Usuarios de Auth
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Asegurar que los perfiles tengan el rol 'client' disponible
-- (Nota: Tu check de roles en el código soporta 'admin', 'sales', 'ops', 'read')
-- Agreguemos 'client' conceptualmente.

-- 3. RLS para la tabla CLIENTES
-- El cliente solo puede ver su propia información
DROP POLICY IF EXISTS "Clients can view their own info" ON public.clients;
CREATE POLICY "Clients can view their own info"
ON public.clients
FOR SELECT
USING (
  (auth.uid() = user_id) OR (get_current_user_role() IN ('admin', 'ops', 'sales'))
);

-- 4. RLS para la tabla ENVIOS (Shipments)
-- El cliente solo puede ver envíos asociados a su client_id
DROP POLICY IF EXISTS "Clients can view their own shipments" ON public.shipments;
CREATE POLICY "Clients can view their own shipments"
ON public.shipments
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = shipments.client_id 
    AND user_id = auth.uid()
  ))
  OR 
  (get_current_user_role() IN ('admin', 'ops', 'sales'))
);

-- ============================================================
-- INSTRUCCIONES:
-- 1. Ejecuta esto en el SQL Editor de Supabase.
-- 2. Para probar, asigna el 'id' de un usuario de auth.users 
--    a la columna 'user_id' de un cliente en la tabla 'clients'.
-- ============================================================
