-- 1. RE-STOCK INVENTORY
INSERT INTO public.inventory (medicine_name, generic_name, quantity, unit_price, supplier)
VALUES 
('Amoxicillin 500mg', 'Antibiotic', 150, 12.50, 'Zydus Lifesciences'),
('Paracetamol 650mg', 'Analgesic', 500, 2.00, 'Micro Labs (Dolo)'),
('Metformin 500mg', 'Antidiabetic', 200, 8.50, 'Sun Pharma'),
('Cetirizine 10mg', 'Antihistamine', 300, 5.00, 'Cipla'),
('Atorvastatin 20mg', 'Cholesterol', 100, 22.00, 'Lupin')
ON CONFLICT (medicine_name) DO UPDATE 
SET quantity = EXCLUDED.quantity, unit_price = EXCLUDED.unit_price;

-- 2. CREATE MOCK SESSIONS & NAMES
DO $$ 
DECLARE
    p1_id uuid := '44444444-4444-4444-4444-444444444444';
    p2_id uuid := '55555555-5555-5555-5555-555555555555';
    p3_id uuid := '66666666-6666-6666-6666-666666666666';
    rx_id uuid;
BEGIN
    -- Ensure mock profiles exist so names show up
    INSERT INTO public.profiles (user_id, full_name, age) VALUES 
    (p1_id, 'Kavin Kumar (Mock)', 24),
    (p2_id, 'Deepak Raj (Mock)', 32),
    (p3_id, 'Saritha (Mock)', 45)
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    -- Add them to the live Queue
    DELETE FROM public.queue_entries WHERE token_number IN ('T-101', 'T-102', 'T-103');
    INSERT INTO public.queue_entries (token_number, patient_id, priority, status, reason)
    VALUES 
    ('T-101', p1_id, 'normal', 'waiting', 'Regular fever checkup'),
    ('T-102', p2_id, 'urgent', 'in_progress', 'Acute stomach pain'),
    ('T-103', p3_id, 'elderly', 'waiting', 'Blood pressure check');

    -- Create a Completed Visit for the first patient (demo billing)
    INSERT INTO public.prescriptions (patient_id, doctor_name, medication, dosage, frequency, duration, status)
    VALUES (p1_id, 'Dr. Sharmila', 'Amoxicillin 500mg', '1 tablet', 'Twice daily', '5 days', 'dispensed')
    RETURNING id INTO rx_id;

    INSERT INTO public.billing_records (prescription_id, patient_id, total_amount, status)
    VALUES (rx_id, p1_id, 125.50, 'paid');

END $$;
