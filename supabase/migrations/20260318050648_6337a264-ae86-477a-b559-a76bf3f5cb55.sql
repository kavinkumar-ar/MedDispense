
CREATE OR REPLACE FUNCTION public.get_active_queue()
RETURNS TABLE (
  token_number text,
  priority text,
  status text,
  doctor_name text,
  estimated_wait_minutes integer,
  created_at timestamptz,
  is_mine boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    qe.token_number,
    qe.priority,
    qe.status,
    qe.doctor_name,
    qe.estimated_wait_minutes,
    qe.created_at,
    (qe.patient_id = auth.uid()) as is_mine
  FROM public.queue_entries qe
  WHERE qe.status IN ('waiting', 'in_progress')
  ORDER BY 
    CASE qe.status WHEN 'in_progress' THEN 0 ELSE 1 END,
    CASE qe.priority WHEN 'urgent' THEN 0 WHEN 'elderly' THEN 1 ELSE 2 END,
    qe.created_at ASC;
$$;
