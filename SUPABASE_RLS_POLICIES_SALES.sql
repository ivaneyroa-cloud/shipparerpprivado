-- ==========================================
-- SHIPPAR COURIER WEB - STRICT RLS POLICIES
-- ==========================================
-- Objective: Secure the 'clients' and 'shipments' tables directly at the DB level,
-- ensuring that users with the 'sales' role can ONLY see and interact with their assigned data.
-- Even if the frontend code is modified or bypassed, the database will enforce these rules.

-- 1. Enable RLS on the tables if not already enabled.
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create a helper function to get the current user's role securely
-- This depends on your existing 'profiles' setup. Assuming 'role' is stored in 'profiles'.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 3. POLICIES FOR 'clients' TABLE
-- Drop existing select policy if it exists to replace it
DROP POLICY IF EXISTS "Users can view clients based on role" ON public.clients;

CREATE POLICY "Users can view clients based on role"
ON public.clients
FOR SELECT
USING (
  (get_current_user_role() IN ('admin', 'ops')) -- Admins & Ops see everything
  OR 
  (get_current_user_role() = 'sales' AND assigned_to = auth.uid()) -- Sales see ONLY their assigned clients
);

-- Note: You might want similar policies for UPDATE/DELETE on clients depending on your business rules.
-- For example, can sales update their assigned clients?
DROP POLICY IF EXISTS "Sales can update assigned clients" ON public.clients;
CREATE POLICY "Sales can update assigned clients"
ON public.clients
FOR UPDATE
USING (
  (get_current_user_role() = 'sales' AND assigned_to = auth.uid()) OR (get_current_user_role() IN ('admin', 'ops'))
);


-- 4. POLICIES FOR 'shipments' TABLE
-- Since shipments don't have 'assigned_to' directly, they belong to a 'client_name' (or preferably client_id).
-- We need to check if the shipment belongs to a client assigned to the current user.
DROP POLICY IF EXISTS "Users can view shipments based on role" ON public.shipments;

CREATE POLICY "Users can view shipments based on role"
ON public.shipments
FOR SELECT
USING (
  (get_current_user_role() IN ('admin', 'ops'))
  OR
  (get_current_user_role() = 'sales' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE name = shipments.client_name 
      AND assigned_to = auth.uid()
  ))
);

-- Policy for updating shipments (Sales can only update shipments of their assigned clients)
DROP POLICY IF EXISTS "Users can update shipments based on role" ON public.shipments;

CREATE POLICY "Users can update shipments based on role"
ON public.shipments
FOR UPDATE
USING (
  (get_current_user_role() IN ('admin', 'ops'))
  OR
  (get_current_user_role() = 'sales' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE name = shipments.client_name 
      AND assigned_to = auth.uid()
  ))
);

-- Policy for inserting shipments (Sales can only insert shipments for their assigned clients)
DROP POLICY IF EXISTS "Users can insert shipments based on role" ON public.shipments;

CREATE POLICY "Users can insert shipments based on role"
ON public.shipments
FOR INSERT
WITH CHECK (
  (get_current_user_role() IN ('admin', 'ops'))
  OR
  (get_current_user_role() = 'sales' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE name = shipments.client_name 
      AND assigned_to = auth.uid()
  ))
);

-- ==========================================
-- HOW TO APPLY THIS:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to the SQL Editor
-- 3. Paste this entire script and click "Run"
-- ==========================================
