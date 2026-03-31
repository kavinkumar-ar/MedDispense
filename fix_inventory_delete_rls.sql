-- Fix: Extend the DELETE policy to also allow pharmacists to delete inventory items
-- Drop the admin-only policy and replace with one that covers both roles

DROP POLICY IF EXISTS "Admins can delete inventory" ON public.inventory;

CREATE POLICY "Staff can delete inventory" ON public.inventory
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'pharmacist'::app_role)
);
