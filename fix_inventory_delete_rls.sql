-- Fix: Allow admin and pharmacist roles to delete inventory items
-- Run this in your Supabase SQL Editor

-- First check what policies exist on inventory
-- SELECT * FROM pg_policies WHERE tablename = 'inventory';

-- Add DELETE policy for admin
CREATE POLICY "Admins can delete inventory" ON public.inventory
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Add DELETE policy for pharmacist
CREATE POLICY "Pharmacists can delete inventory" ON public.inventory
FOR DELETE USING (public.has_role(auth.uid(), 'pharmacist'));
