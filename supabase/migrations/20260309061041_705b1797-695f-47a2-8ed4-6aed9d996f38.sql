
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
