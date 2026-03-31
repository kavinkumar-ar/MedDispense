-- Run this in your Supabase SQL Editor to instantly give all your existing test patients an age!
UPDATE public.profiles
SET age = floor(random() * (65 - 18 + 1) + 18)::int
WHERE age IS NULL AND full_name IS NOT NULL;
