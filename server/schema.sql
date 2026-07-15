-- SQL Schema for Project AANCHAL (आँचल) Database Setup
-- Paste this script into the Supabase SQL Editor (https://supabase.com -> Project -> SQL Editor) and run it.

-- 1. Enable any required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Stored as plaintext (same as the baseline in-memory backend for ease of demo/use)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Emergency Contacts Table
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. OTP Store Table (handles forgot password flows)
CREATE TABLE IF NOT EXISTS public.otp_store (
    phone TEXT PRIMARY KEY,
    otp TEXT NOT NULL,
    expires_at BIGINT NOT NULL, -- Unix timestamp in milliseconds
    verified BOOLEAN DEFAULT false NOT NULL,
    username TEXT
);

-- 5. Distress Alerts Table
CREATE TABLE IF NOT EXISTS public.distress_alerts (
    id TEXT PRIMARY KEY,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    type TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Insert Mock Data (Same as the baseline server)
INSERT INTO public.emergency_contacts (name, phone, relationship)
VALUES 
    ('Emergency Services (National)', '112', 'Official'),
    ('Emergency Contact 1 (Father)', '+919876543210', 'Family'),
    ('Emergency Contact 2 (Sister)', '+918765432109', 'Family')
ON CONFLICT DO NOTHING;

INSERT INTO public.users (username, phone, password)
VALUES ('admin', '9876543210', 'password')
ON CONFLICT DO NOTHING;


-- NOTE ON SECURITY:
-- By default, Row Level Security (RLS) is enabled on new Supabase tables.
-- If you use the SUPABASE_SERVICE_ROLE_KEY on the server (recommended for trusted Node backends),
-- the server will bypass RLS automatically.
-- If you use the anon key, you should disable RLS for these tables or create appropriate SELECT/INSERT/DELETE policies.
-- To disable RLS (for testing/easy local setup):
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_store DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.distress_alerts DISABLE ROW LEVEL SECURITY;
