CREATE POLICY "Staff can insert queue entries"
ON public.queue_entries
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role)
  OR has_role(auth.uid(), 'pharmacist'::app_role)
);