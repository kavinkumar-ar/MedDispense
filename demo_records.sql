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

-- 2. DYNAMICALLY ADD RECORDS USING YOUR EXISTING USER ID
DO $$ 
DECLARE
    real_user_id uuid;
    rx_id uuid;
BEGIN
    -- This looks for the first available user in your system
    SELECT id INTO real_user_id FROM auth.users LIMIT 1;

    IF real_user_id IS NULL THEN
        RAISE EXCEPTION 'ERROR: No users found. Please create at least one account first!';
    END IF;

    -- Add Patients to Queue
    INSERT INTO public.queue_entries (token_number, patient_id, priority, status, reason)
    VALUES 
    ('T-1001', real_user_id, 'normal', 'waiting', 'Regular fever checkup'),
    ('T-1002', real_user_id, 'urgent', 'waiting', 'Acute stomach pain');

    -- Add a Completed Consultation & Bill
    INSERT INTO public.prescriptions (patient_id, doctor_name, medication, dosage, frequency, duration, status)
    VALUES (real_user_id, 'Dr. Sharmila', 'Amoxicillin 500mg', '1 tablet', 'Twice daily', '5 days', 'dispensed')
    RETURNING id INTO rx_id;

    INSERT INTO public.billing_records (prescription_id, patient_id, total_amount, status)
    VALUES (rx_id, real_user_id, 125.50, 'paid');

END $$;
