-- POPULATE INVENTORY
INSERT INTO public.inventory (medicine_name, generic_name, quantity, unit_price, supplier)
VALUES 
('Amoxicillin 500mg', 'Antibiotic', 150, 12.50, 'Zydus Lifesciences'),
('Paracetamol 650mg', 'Analgesic', 500, 2.00, 'Micro Labs (Dolo)'),
('Metformin 500mg', 'Antidiabetic', 200, 8.50, 'Sun Pharma'),
('Cetirizine 10mg', 'Antihistamine', 300, 5.00, 'Cipla'),
('Atorvastatin 20mg', 'Cholesterol', 100, 22.00, 'Lupin')
ON CONFLICT (medicine_name) DO UPDATE 
SET quantity = EXCLUDED.quantity, unit_price = EXCLUDED.unit_price;

-- CREATE SAMPLE QUEUE ENTRIES
INSERT INTO public.queue_entries (token_number, patient_id, priority, status, reason)
VALUES 
('T-1001', gen_random_uuid(), 'normal', 'waiting', 'Regular fever checkup'),
('T-1002', gen_random_uuid(), 'urgent', 'waiting', 'Acute stomach pain'),
('T-1003', gen_random_uuid(), 'normal', 'in_progress', 'Follow-up consultation')
ON CONFLICT DO NOTHING;
