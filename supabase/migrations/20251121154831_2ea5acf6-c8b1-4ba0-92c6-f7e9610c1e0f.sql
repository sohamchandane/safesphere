-- Create profiles table for user personal information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  dob DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create medical history table
CREATE TABLE public.medical_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnosis_status BOOLEAN NOT NULL,
  diagnosis_date DATE,
  known_triggers TEXT[], -- Array of triggers: dust_mites, pollen, cold_air, exercise, occupational, seasonal
  attack_history JSONB, -- Store array of {date, severity, trigger}
  current_symptoms TEXT[], -- breathlessness, cough, wheezing, chest_tightness
  respiratory_issues TEXT[], -- allergic_rhinitis, chronic_cough, sinusitis
  allergies TEXT[], -- pets, dust, pollen, mold, food, nsaids
  smoking_status TEXT CHECK (smoking_status IN ('never', 'former', 'current')),
  family_history BOOLEAN,
  chronic_conditions TEXT[], -- hypertension, diabetes, etc
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create user monitoring data table
CREATE TABLE public.monitoring_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Weather data
  temperature NUMERIC,
  pressure NUMERIC,
  co NUMERIC,
  no NUMERIC,
  no2 NUMERIC,
  o3 NUMERIC,
  so2 NUMERIC,
  pm2_5 NUMERIC,
  pm10 NUMERIC,
  nh3 NUMERIC,
  
  -- Pollen data
  grass_pollen NUMERIC,
  tree_pollen NUMERIC,
  weed_pollen NUMERIC,
  
  -- Location data
  latitude NUMERIC,
  longitude NUMERIC,
  
  -- Health data
  heart_rate NUMERIC,
  
  -- Predictions
  attack_prediction BOOLEAN,
  prediction_confidence NUMERIC,
  
  -- Ground truth (filled later via email)
  ground_truth BOOLEAN,
  ground_truth_updated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
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

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medical_history_updated_at
  BEFORE UPDATE ON public.medical_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_monitoring_data_user_timestamp ON public.monitoring_data(user_id, timestamp DESC);
CREATE INDEX idx_medical_history_user ON public.medical_history(user_id);