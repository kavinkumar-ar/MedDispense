-- Walk-In Patient Registration Handler
-- Run this securely in your Supabase SQL Editor.
-- This function runs inside the deep database level to safely provision
-- an authentic GoTrue account without breaking the Queue relationships.

CREATE OR REPLACE FUNCTION public.create_walkin_patient(p_name text, p_phone text)
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
    v_dummy_email, crypt(gen_random_uuid()::text, gen_salt('bf')), 
    now(), '{"provider":"email","providers":["email"]}', 
    json_build_object('full_name', p_name, 'phone', p_phone, 'is_walkin', true), 
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
  -- Now we just manually inject the phone number back into their generated Profile.
  UPDATE public.profiles SET phone = p_phone WHERE user_id = v_user_id;

  -- Instantly bounce the new UUID back to the queue
  RETURN v_user_id;
END;
$$;
