
-- Queue entries table for patients requesting to see a doctor
CREATE TABLE public.queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_number text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'waiting',
  doctor_name text,
  reason text,
  estimated_wait_minutes integer DEFAULT 15,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Prescriptions table
CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_name text NOT NULL,
  medication text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  duration text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  prescribed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- RLS: Patients can view their own queue entries
CREATE POLICY "Patients can view own queue entries" ON public.queue_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = patient_id);

-- RLS: Patients can insert their own queue entries
CREATE POLICY "Patients can insert own queue entries" ON public.queue_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id);

-- RLS: Admins/doctors/pharmacists can view all queue entries
CREATE POLICY "Staff can view all queue entries" ON public.queue_entries
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'pharmacist')
  );

-- RLS: Staff can update queue entries
CREATE POLICY "Staff can update queue entries" ON public.queue_entries
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'pharmacist')
  );

-- RLS: Patients can view their own prescriptions
CREATE POLICY "Patients can view own prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = patient_id);

-- RLS: Staff can view all prescriptions
CREATE POLICY "Staff can view all prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'pharmacist')
  );

-- RLS: Doctors/admins can insert prescriptions
CREATE POLICY "Doctors can insert prescriptions" ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor')
  );

-- RLS: Pharmacists can update prescription status
CREATE POLICY "Pharmacists can update prescriptions" ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'pharmacist')
  );

-- Enable realtime for queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
