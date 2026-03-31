-- Completely overwrite the default handle_new_user function to forcefully capture 'phone' and 'age' from the metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into the profiles table natively parsing out the raw metadata JSON package sent from the Register.tsx portal
  INSERT INTO public.profiles (user_id, full_name, phone, age)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    (NEW.raw_user_meta_data->>'age')::integer
  );

  -- Immediately provision this user with rigid 'patient' access constraints
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient');

  RETURN NEW;
END;
$$;
