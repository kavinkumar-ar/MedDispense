-- Advanced Medical Data Seed
-- This script safely generates rich, realistic test data for the Queue Status,
-- Doctor Panel, and Prescriptions WITHOUT breaking foreign key security rules.

DO $$
DECLARE
  v_patient_id uuid;
BEGIN
  -- We securely fetch the ID of whoever you registered as a 'patient'
  SELECT user_id INTO v_patient_id FROM public.user_roles WHERE role = 'patient' LIMIT 1;

  -- Safety check: if you haven't registered a patient yet, it politely stops.
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'No patient account exists! Please go register at least 1 patient through your website (or add the role) before generating medical records.';
  END IF;

  -- 1. Wipe old duplicate records safely
  DELETE FROM public.queue_entries;
  DELETE FROM public.prescriptions;

  -- 2. Populate realistic Queue Statuses for the Doctor Panel
  INSERT INTO public.queue_entries (patient_id, token_number, priority, status, doctor_name, reason, estimated_wait_minutes) VALUES
  (v_patient_id, 'T-1001', 'urgent', 'waiting', 'Dr. Palaniappan Manickam', 'Severe chest pain', 5),
  (v_patient_id, 'T-1002', 'normal', 'in_progress', 'Dr. Palaniappan Manickam', 'Routine checkup', 0),
  (v_patient_id, 'T-1003', 'elderly', 'waiting', 'Dr. Sharmila', 'Arthritis consultation', 15),
  (v_patient_id, 'T-1004', 'normal', 'completed', 'Dr. Palaniappan Manickam', 'Post-Op Follow-up', NULL),
  (v_patient_id, 'T-1005', 'normal', 'waiting', 'Dr. Sharmila', 'Fever and chills', 25);

  -- 3. Populate varied Prescriptions for Pharmacist and Patient views
  INSERT INTO public.prescriptions (patient_id, doctor_name, medication, dosage, frequency, duration, status, notes) VALUES
  (v_patient_id, 'Dr. Palaniappan Manickam', 'Amoxicillin 500mg', '1 capsule', '3 times a day', '7 days', 'pending', 'Take entirely with food'),
  (v_patient_id, 'Dr. Sharmila', 'Ibuprofen 400mg', '1 tablet', 'As needed for pain', '5 days', 'dispensed', 'Do not exceed 3 tablets per day'),
  (v_patient_id, 'Dr. Palaniappan Manickam', 'Lisinopril 10mg', '1 tablet', 'Once daily', '30 days', 'pending', 'Take in the morning'),
  (v_patient_id, 'Dr. Sharmila', 'Metformin 500mg', '1 tablet', 'Twice daily', '90 days', 'pending', 'Take strictly with main meals');

END $$;
