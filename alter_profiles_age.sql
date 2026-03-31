-- 1. ADD THE AGE COLUMN NATIVELY TO YOUR PATIENT PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age integer DEFAULT null;

-- 2. SECURELY OVERWRITE THE WALK-IN GENERATOR TO SUPPORT THE NEW AGE PARAMETER
CREATE OR REPLACE FUNCTION public.create_walkin_patient(p_name text, p_phone text, p_age integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_dummy_email text := 'walkin_' || replace(v_user_id::text, '-', '') || '@hospital.local';
BEGIN
  -- Insert safely into auth.users using a completely dummy hashed token
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', 
    v_dummy_email, extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), 
    now(), '{"provider":"email","providers":["email"]}', 
    json_build_object('full_name', p_name, 'phone', p_phone, 'age', p_age, 'is_walkin', true), 
    now(), now()
  );

  -- Insert natively into identities to completely satisfy GoTrue schema validations
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id, v_user_id::text, 
    format('{"sub":"%s","email":"%s"}', v_user_id::text, v_dummy_email)::jsonb, 
    'email', now(), now(), now()
  );

  -- The existing trigger ('handle_new_user') automatically created their Profile and assigned the 'patient' role!
  -- Now we uniquely inject the phone number AND the new AGE directly into their Profile.
  UPDATE public.profiles SET phone = p_phone, age = p_age WHERE user_id = v_user_id;

  -- Instantly bounce the new UUID back to the queue
  RETURN v_user_id;
END;
$$;
