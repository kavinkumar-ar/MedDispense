-- ============================================================
-- INVENTORY HISTORY SETUP
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create the inventory_history table
CREATE TABLE IF NOT EXISTS public.inventory_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  medicine_name TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('added', 'removed', 'deleted', 'edited')),
  quantity_before INTEGER,
  quantity_after INTEGER,
  quantity_changed INTEGER,
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;

-- 3. Allow admin and pharmacist to read history
CREATE POLICY "Staff can view inventory history" ON public.inventory_history
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'pharmacist'::app_role)
  OR public.has_role(auth.uid(), 'doctor'::app_role)
);

-- 4. Allow admin and pharmacist to insert history records
CREATE POLICY "Staff can insert inventory history" ON public.inventory_history
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'pharmacist'::app_role)
);
