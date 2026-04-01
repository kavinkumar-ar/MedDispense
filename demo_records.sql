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

-- 2. DYNAMICALLY GENERATE RECORDS FOR REAL USERS
DO $$ 
DECLARE
    user_1 uuid;
    user_2 uuid;
    rx_id uuid;
BEGIN
    -- FETCH THE FIRST TWO REAL USERS IN YOUR SYSTEM
    SELECT id INTO user_1 FROM auth.users ORDER BY created_at ASC OFFSET 0 LIMIT 1;
    SELECT id INTO user_2 FROM auth.users ORDER BY created_at ASC OFFSET 1 LIMIT 1;

    -- SAFETY CHECK
    IF user_1 IS NULL THEN
        RAISE EXCEPTION 'ERROR: No users found. Please sign up in your app first!';
    END IF;

    -- Update Profile names so the demo looks clean
    UPDATE public.profiles SET full_name = 'Kavin Kumar (Patient)' WHERE user_id = user_1;
    IF user_2 IS NOT NULL THEN
        UPDATE public.profiles SET full_name = 'Deepak Raj (Patient)' WHERE user_id = user_2;
    END IF;

    -- CLEAN ACTIVE RECORDS
    DELETE FROM public.queue_entries;
    DELETE FROM public.prescriptions;

    -- ADD PATIENTS TO QUEUE (Using Real IDs)
    INSERT INTO public.queue_entries (token_number, patient_id, priority, status, reason)
    VALUES 
    ('T-101', user_1, 'normal', 'waiting', 'Regular fever checkup');

    IF user_2 IS NOT NULL THEN
        INSERT INTO public.queue_entries (token_number, patient_id, priority, status, reason)
        VALUES ('T-102', user_2, 'urgent', 'in_progress', 'Acute stomach pain');
    END IF;

    -- CREATE A COMPLETED VISIT FOR YOUR DASHBOARD (Bill & Downloadable Rx)
    INSERT INTO public.prescriptions (patient_id, doctor_name, medication, dosage, frequency, duration, status)
    VALUES (user_1, 'Dr. Sharmila', 'Amoxicillin 500mg', '1 tablet', 'Twice daily', '5 days', 'dispensed')
    RETURNING id INTO rx_id;

    INSERT INTO public.billing_records (prescription_id, patient_id, total_amount, status)
    VALUES (rx_id, user_1, 125.50, 'paid');

END $$;
