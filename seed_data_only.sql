-- Supabase Data Seeding Script (NO AUTH HACKS)
-- This script safely inserts all pharmacy and patient data WITHOUT touching
-- the internal Supabase Security tables. It intelligently links the sample
-- data to whoever you register manually!

-- 1. Inventory Items
DELETE FROM public.inventory;

INSERT INTO public.inventory (medicine_name, generic_name, quantity, unit, low_stock_threshold, batch_number, expiry_date, supplier, unit_price) VALUES
('Amoxicillin 500mg', 'Amoxicillin', 150, 'capsules', 50, 'BT-2023-X1', '2025-12-01', 'PharmaGlobal', 0.50),
('Ibuprofen 400mg', 'Ibuprofen', 300, 'tablets', 100, 'BT-2023-I2', '2026-06-15', 'HealthMeds', 0.20),
('Lisinopril 10mg', 'Lisinopril', 15, 'tablets', 30, 'BT-2024-L3', '2024-05-20', 'HeartCare Inc', 0.85),
('Metformin 500mg', 'Metformin', 500, 'tablets', 100, 'BT-2024-M4', '2027-01-10', 'DiabSupplies', 0.15),
('Atorvastatin 20mg', 'Atorvastatin', 60, 'tablets', 40, 'BT-2023-A5', '2025-11-25', 'PharmaGlobal', 1.10),
('Albuterol Inhaler', 'Albuterol Sulfate', 5, 'inhalers', 10, 'BT-2024-AL6', '2025-08-30', 'BreathEasy', 25.00),
('Omeprazole 20mg', 'Omeprazole', 200, 'capsules', 50, 'BT-2024-O7', '2026-03-12', 'DigestiveHealth', 0.40),
('Amlodipine 5mg', 'Amlodipine Besylate', 0, 'tablets', 50, 'BT-2023-AM8', '2025-02-28', 'HeartCare Inc', 0.35);


-- 2. Queue Entries (Dynamically linking to whatever user is a patient)
DELETE FROM public.queue_entries;

INSERT INTO public.queue_entries (patient_id, token_number, priority, status, doctor_name, reason, estimated_wait_minutes)
SELECT user_id, 'T-1001', 'urgent', 'waiting', 'Dr. Smith', 'Severe chest pain', 5 
FROM public.user_roles LIMIT 1;

INSERT INTO public.queue_entries (patient_id, token_number, priority, status, doctor_name, reason, estimated_wait_minutes)
SELECT user_id, 'T-1002', 'normal', 'in_progress', 'Dr. Smith', 'Routine checkup', 0 
FROM public.user_roles LIMIT 1;


-- 3. Prescriptions (Dynamically linking to whatever user is available)
DELETE FROM public.prescriptions;

INSERT INTO public.prescriptions (patient_id, doctor_name, medication, dosage, frequency, duration, status, notes) 
SELECT user_id, 'Dr. Smith', 'Amoxicillin 500mg', '1 capsule', '3 times a day', '7 days', 'pending', 'Take with food' 
FROM public.user_roles LIMIT 1;

INSERT INTO public.prescriptions (patient_id, doctor_name, medication, dosage, frequency, duration, status, notes) 
SELECT user_id, 'Dr. Smith', 'Ibuprofen 400mg', '1 tablet', 'As needed for pain', '5 days', 'dispensed', 'Do not exceed 3 tablets per day' 
FROM public.user_roles LIMIT 1;
