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

-- 2. ADD PATIENTS TO QUEUE
INSERT INTO public.queue_entries (token_number, patient_id, priority, status, reason)
VALUES 
('T-1001', gen_random_uuid(), 'normal', 'waiting', 'Regular fever checkup'),
('T-1002', gen_random_uuid(), 'urgent', 'waiting', 'Acute stomach pain'),
('T-1003', gen_random_uuid(), 'normal', 'in_progress', 'Follow-up consultation');

-- 3. ADD A COMPLETED VISIT (WITH BILL & DOWNLOADABLE RX)
DO $$ 
DECLARE
    demo_patient_id uuid := gen_random_uuid(); 
    rx_id uuid;
BEGIN
    INSERT INTO public.prescriptions (patient_id, doctor_name, medication, dosage, frequency, duration, status)
    VALUES (demo_patient_id, 'Dr. Sharmila', 'Amoxicillin 500mg', '1 tablet', 'Twice daily', '5 days', 'dispensed')
    RETURNING id INTO rx_id;

    INSERT INTO public.billing_records (prescription_id, patient_id, total_amount, status)
    VALUES (rx_id, demo_patient_id, 125.00, 'paid');
END $$;
