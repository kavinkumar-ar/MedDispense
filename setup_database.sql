
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'pharmacist', 'patient');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admin can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all roles
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-create profile and assign patient role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Confirm the existing user's email manually
UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'kavinraj@gmail.com';

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

CREATE POLICY "Doctors can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'doctor'::app_role));
ALTER PUBLICATION supabase_realtime ADD TABLE public.prescriptions;CREATE POLICY "Staff can insert queue entries"
ON public.queue_entries
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role)
  OR has_role(auth.uid(), 'pharmacist'::app_role)
);
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
CREATE POLICY "Pharmacists can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'pharmacist'::app_role));ALTER TABLE public.profiles ADD COLUMN allergies text DEFAULT null;
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_name text NOT NULL UNIQUE,
  generic_name text,
  quantity integer NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'tablets',
  low_stock_threshold integer NOT NULL DEFAULT 20,
  batch_number text,
  expiry_date date,
  supplier text,
  unit_price numeric(10,2),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view inventory" ON public.inventory
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'doctor') OR
    has_role(auth.uid(), 'pharmacist')
  );

CREATE POLICY "Staff can insert inventory" ON public.inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'pharmacist')
  );

CREATE POLICY "Staff can update inventory" ON public.inventory
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'pharmacist')
  );

CREATE POLICY "Admins can delete inventory" ON public.inventory
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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
