
-- Allow admins to delete prescriptions
CREATE POLICY "Admins can delete prescriptions"
ON public.prescriptions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete queue entries
CREATE POLICY "Admins can delete queue entries"
ON public.queue_entries
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
