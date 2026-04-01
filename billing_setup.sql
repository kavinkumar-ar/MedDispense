-- Create Billing Records table
CREATE TABLE IF NOT EXISTS public.billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  paid_at timestamp with time zone
);

-- Add quantity_dispensed to prescriptions for record keeping
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS quantity_dispensed integer;

-- Enable RLS for billing
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;

-- Patients can view their own bills
CREATE POLICY "Patients can view own bills" ON public.billing_records
  FOR SELECT TO authenticated
  USING (auth.uid() = patient_id);

-- Staff can view all bills
CREATE POLICY "Staff can view all bills" ON public.billing_records
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'pharmacist')
  );

-- Pharmacists can insert and update bills
CREATE POLICY "Pharmacists can manage bills" ON public.billing_records
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'pharmacist')
  );

-- Enable realtime for billing
ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_records;
