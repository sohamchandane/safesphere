-- Fix RLS to allow profile creation during signup
-- The key insight: after signUp(), the user's session IS valid for their own ID
-- We just need to allow INSERT without requiring the row to exist first

-- Drop old policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create a policy that allows INSERT when the user is inserting for their own ID
-- This should work because after auth.signUp(), the user's JWT is valid for their ID
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Ensure SELECT and UPDATE policies also exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Medical history policies
DROP POLICY IF EXISTS "Users can view own medical history" ON public.medical_history;
DROP POLICY IF EXISTS "Users can insert own medical history" ON public.medical_history;
DROP POLICY IF EXISTS "Users can update own medical history" ON public.medical_history;

CREATE POLICY "Users can view own medical history"
  ON public.medical_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medical history"
  ON public.medical_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medical history"
  ON public.medical_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Monitoring data policies
DROP POLICY IF EXISTS "Users can view own monitoring data" ON public.monitoring_data;
DROP POLICY IF EXISTS "Users can insert own monitoring data" ON public.monitoring_data;
DROP POLICY IF EXISTS "Users can update own monitoring data" ON public.monitoring_data;

CREATE POLICY "Users can view own monitoring data"
  ON public.monitoring_data FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monitoring data"
  ON public.monitoring_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monitoring data"
  ON public.monitoring_data FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
