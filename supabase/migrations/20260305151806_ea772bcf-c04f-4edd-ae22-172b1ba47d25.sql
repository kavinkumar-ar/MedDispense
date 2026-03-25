
CREATE POLICY "Doctors can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'doctor'::app_role));
