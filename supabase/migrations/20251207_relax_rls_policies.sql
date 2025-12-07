-- Fix registration RLS issue by relaxing policies temporarily
-- Allow profiles to be inserted right after auth signup

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create a more permissive INSERT policy that allows inserts during signup
-- Key insight: after auth.signUp(), the user's JWT is immediately valid for their own ID
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (
    -- Allow insert if the ID matches current user's ID
    auth.uid() = id
    -- OR allow if no profiles exist yet (for first insert)
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

-- Alternatively, if the above doesn't work, use a simpler approach:
-- Just check that the inserting user matches the profile ID
-- This should work because Supabase sets auth.uid() after signup

-- Make sure RLS is enabled for security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_data ENABLE ROW LEVEL SECURITY;

-- Ensure SELECT/UPDATE policies exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Medical history policies
DROP POLICY IF EXISTS "Users can view own medical history" ON public.medical_history;
DROP POLICY IF EXISTS "Users can insert own medical history" ON public.medical_history;
DROP POLICY IF EXISTS "Users can update own medical history" ON public.medical_history;

CREATE POLICY "Users can view own medical history"
  ON public.medical_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medical history"
  ON public.medical_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medical history"
  ON public.medical_history FOR UPDATE
  USING (auth.uid() = user_id);

-- Monitoring data policies
DROP POLICY IF EXISTS "Users can view own monitoring data" ON public.monitoring_data;
DROP POLICY IF EXISTS "Users can insert own monitoring data" ON public.monitoring_data;
DROP POLICY IF EXISTS "Users can update own monitoring data" ON public.monitoring_data;

CREATE POLICY "Users can view own monitoring data"
  ON public.monitoring_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monitoring data"
  ON public.monitoring_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monitoring data"
  ON public.monitoring_data FOR UPDATE
  USING (auth.uid() = user_id);
