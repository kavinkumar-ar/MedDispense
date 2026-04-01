-- Add rejection_reason column to prescriptions table
ALTER TABLE public.prescriptions 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
