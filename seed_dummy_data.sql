-- Supabase Seed Script for MedDispense Demo Data
-- Copy and run this entirely in the Supabase SQL Editor

-- 1. Create Dummy Users (Passwords are universally set to 'password123')
-- Admin
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'admin@demo.com', crypt('password123', gen_salt('bf')), now(), '{"full_name":"Admin User"}');

-- Doctor
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'doctor@demo.com', crypt('password123', gen_salt('bf')), now(), '{"full_name":"Dr. Smith"}');

-- Pharmacist
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'pharmacist@demo.com', crypt('password123', gen_salt('bf')), now(), '{"full_name":"Jane Pharmacist"}');

-- Patient 1
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'patient1@demo.com', crypt('password123', gen_salt('bf')), now(), '{"full_name":"John Doe"}');

-- Patient 2
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES ('55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'patient2@demo.com', crypt('password123', gen_salt('bf')), now(), '{"full_name":"Mary Jane"}');

-- 2. Fix the roles. 
-- (Our auth trigger automatically made them all 'patient', so we update the staff roles)
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '11111111-1111-1111-1111-111111111111';
UPDATE public.user_roles SET role = 'doctor' WHERE user_id = '22222222-2222-2222-2222-222222222222';
UPDATE public.user_roles SET role = 'pharmacist' WHERE user_id = '33333333-3333-3333-3333-333333333333';

-- 3. Insert rich Inventory Data
INSERT INTO public.inventory (medicine_name, generic_name, quantity, unit, low_stock_threshold, batch_number, expiry_date, supplier, unit_price) VALUES
('Amoxicillin 500mg', 'Amoxicillin', 150, 'capsules', 50, 'BT-2023-X1', '2025-12-01', 'PharmaGlobal', 0.50),
('Ibuprofen 400mg', 'Ibuprofen', 300, 'tablets', 100, 'BT-2023-I2', '2026-06-15', 'HealthMeds', 0.20),
('Lisinopril 10mg', 'Lisinopril', 15, 'tablets', 30, 'BT-2024-L3', '2024-05-20', 'HeartCare Inc', 0.85),
('Metformin 500mg', 'Metformin', 500, 'tablets', 100, 'BT-2024-M4', '2027-01-10', 'DiabSupplies', 0.15),
('Atorvastatin 20mg', 'Atorvastatin', 60, 'tablets', 40, 'BT-2023-A5', '2025-11-25', 'PharmaGlobal', 1.10),
('Albuterol Inhaler', 'Albuterol Sulfate', 5, 'inhalers', 10, 'BT-2024-AL6', '2025-08-30', 'BreathEasy', 25.00),
('Omeprazole 20mg', 'Omeprazole', 200, 'capsules', 50, 'BT-2024-O7', '2026-03-12', 'DigestiveHealth', 0.40),
('Amlodipine 5mg', 'Amlodipine Besylate', 0, 'tablets', 50, 'BT-2023-AM8', '2025-02-28', 'HeartCare Inc', 0.35);

-- 4. Queue Entries
INSERT INTO public.queue_entries (patient_id, token_number, priority, status, doctor_name, reason, estimated_wait_minutes) VALUES
('44444444-4444-4444-4444-444444444444', 'T-1001', 'urgent', 'waiting', 'Dr. Smith', 'Severe chest pain', 5),
('55555555-5555-5555-5555-555555555555', 'T-1002', 'normal', 'in_progress', 'Dr. Smith', 'Routine checkup', 0);

-- 5. Prescriptions
INSERT INTO public.prescriptions (patient_id, doctor_name, medication, dosage, frequency, duration, status, notes) VALUES
('44444444-4444-4444-4444-444444444444', 'Dr. Smith', 'Amoxicillin 500mg', '1 capsule', '3 times a day', '7 days', 'pending', 'Take with food'),
('55555555-5555-5555-5555-555555555555', 'Dr. Smith', 'Ibuprofen 400mg', '1 tablet', 'As needed for pain', '5 days', 'dispensed', 'Do not exceed 3 tablets per day');
