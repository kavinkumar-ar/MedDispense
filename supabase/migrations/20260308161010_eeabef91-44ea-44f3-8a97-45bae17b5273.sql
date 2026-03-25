CREATE POLICY "Pharmacists can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'pharmacist'::app_role));