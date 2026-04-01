-- Add doctor_id column to prescriptions
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES auth.users(id);

-- Update existing prescriptions to link doctor_id if a matching profile is found (best effort)
UPDATE public.prescriptions p
SET doctor_id = pr.user_id
FROM public.profiles pr
WHERE p.doctor_name = pr.full_name
AND pr.user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'doctor');

-- Ensure future prescriptions include doctor_id
-- We'll rely on the application to handle this, but adding a NOT NULL constraint would be safer after migration
