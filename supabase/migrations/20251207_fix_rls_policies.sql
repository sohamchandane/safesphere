-- Fix RLS policies and add automatic profile creation on auth signup
-- This migration ensures:
-- 1. Profiles are auto-created when users sign up
-- 2. RLS policies allow users to insert/update their own data

-- Drop existing policies to recreate them with proper logic
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own medical history" ON public.medical_history;
DROP POLICY IF EXISTS "Users can insert own medical history" ON public.medical_history;
DROP POLICY IF EXISTS "Users can update own medical history" ON public.medical_history;

DROP POLICY IF EXISTS "Users can view own monitoring data" ON public.monitoring_data;
DROP POLICY IF EXISTS "Users can insert own monitoring data" ON public.monitoring_data;
DROP POLICY IF EXISTS "Users can update own monitoring data" ON public.monitoring_data;

-- Recreate RLS Policies for profiles (with proper insert logic)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for medical_history
CREATE POLICY "Users can view own medical history"
  ON public.medical_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medical history"
  ON public.medical_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medical history"
  ON public.medical_history FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for monitoring_data
CREATE POLICY "Users can view own monitoring data"
  ON public.monitoring_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monitoring data"
  ON public.monitoring_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monitoring data"
  ON public.monitoring_data FOR UPDATE
  USING (auth.uid() = user_id);

-- Create a trigger function that auto-creates a profile when user signs up
-- This is critical for RLS to work during registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, dob, gender)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'dob')::DATE, CURRENT_DATE),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'other')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if it exists to avoid duplication
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to run on every auth.users INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add missing columns to monitoring_data if they don't exist
ALTER TABLE public.monitoring_data ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE public.monitoring_data ADD COLUMN IF NOT EXISTS raw_response JSONB;
