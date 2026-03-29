-- Powerful Multi-Patient Demo Generator Script
-- Run this in the Supabase SQL Editor to spawn exactly 3 completely different
-- patients filling up the Queue!

-- 1. Safely remove any previous mock patients we generated to prevent duplicates
DELETE FROM auth.users WHERE email IN ('mock1@hospital.com', 'mock2@hospital.com', 'mock3@hospital.com');

-- 2. Create 3 distinct Dummy Patients directly inside the secure system (Passwords: password123)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES 
('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mock1@hospital.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rajesh Kumar"}', now(), now()),
('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'mock2@hospital.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Sharma"}', now(), now()),
('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'mock3@hospital.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mohammed Ali"}', now(), now());

-- 3. Perfectly sync their internal security identities to prevent login 500 crashes
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES 
('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', format('{"sub":"%s","email":"%s"}', '10000000-0000-0000-0000-000000000001', 'mock1@hospital.com')::jsonb, 'email', now(), now(), now()),
('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', format('{"sub":"%s","email":"%s"}', '20000000-0000-0000-0000-000000000002', 'mock2@hospital.com')::jsonb, 'email', now(), now(), now()),
('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', format('{"sub":"%s","email":"%s"}', '30000000-0000-0000-0000-000000000003', 'mock3@hospital.com')::jsonb, 'email', now(), now(), now());

-- (No role update needed! Your native Supabase Trigger automatically made them 'patient' just now!)

-- 4. Clean up queues and assign them explicitly to our specific mock users!
DELETE FROM public.queue_entries;
DELETE FROM public.prescriptions;

INSERT INTO public.queue_entries (patient_id, token_number, priority, status, doctor_name, reason, estimated_wait_minutes) VALUES
('10000000-0000-0000-0000-000000000001', 'T-1001', 'urgent', 'waiting', 'Dr. Palaniappan Manickam', 'Chest congestion', 5),
('20000000-0000-0000-0000-000000000002', 'T-1002', 'normal', 'in_progress', 'Dr. Sharmila', 'Routine checkup', 0),
('30000000-0000-0000-0000-000000000003', 'T-1003', 'elderly', 'waiting', 'Dr. Balaji', 'Arthritis consultation', 15),
('10000000-0000-0000-0000-000000000001', 'T-1004', 'normal', 'completed', 'Dr. Kavya', 'Post-Op Follow-up', NULL);

INSERT INTO public.prescriptions (patient_id, doctor_name, medication, dosage, frequency, duration, status, notes) VALUES
('10000000-0000-0000-0000-000000000001', 'Dr. Palaniappan Manickam', 'Amoxicillin 500mg', '1 capsule', '3 times a day', '7 days', 'pending', 'Take entirely with food'),
('20000000-0000-0000-0000-000000000002', 'Dr. Sharmila', 'Ibuprofen 400mg', '1 tablet', 'As needed for pain', '5 days', 'dispensed', 'Do not exceed 3 tablets per day'),
('30000000-0000-0000-0000-000000000003', 'Dr. Balaji', 'Lisinopril 10mg', '1 tablet', 'Once daily', '30 days', 'pending', 'Take in the morning');
