import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Activity, ArrowRight, ArrowLeft } from 'lucide-react';
import { PersonalInfoStep } from './register/PersonalInfoStep';
import { MedicalHistoryStep } from './register/MedicalHistoryStep';

interface PersonalInfo {
  email: string;
  password: string;
  username: string;
  dob: string;
  gender: string;
  phoneNumber: string;
}

interface MedicalHistory {
  diagnosisStatus: boolean;
  diagnosisDate: string;
  knownTriggers: string[];
  attackHistory: any[];
  currentSymptoms: string[];
  respiratoryIssues: string[];
  allergies: string[];
  smokingStatus: string;
  familyHistory: boolean;
  chronicConditions: string[];
}

export const RegisterForm = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    email: '',
    password: '',
    username: '',
    dob: '',
    gender: '',
    phoneNumber: '',
  });
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory>({
    diagnosisStatus: false,
    diagnosisDate: '',
    knownTriggers: [],
    attackHistory: [],
    currentSymptoms: [],
    respiratoryIssues: [],
    allergies: [],
    smokingStatus: 'never',
    familyHistory: false,
    chronicConditions: [],
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRegister = async () => {
    setLoading(true);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: personalInfo.email,
        password: personalInfo.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Registration failed');
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: personalInfo.username,
          dob: personalInfo.dob,
          gender: personalInfo.gender,
          phone_number: personalInfo.phoneNumber,
        });

      if (profileError) throw profileError;

      // Create medical history
      const { error: medicalError } = await supabase
        .from('medical_history')
        .insert({
          user_id: authData.user.id,
          diagnosis_status: medicalHistory.diagnosisStatus,
          diagnosis_date: medicalHistory.diagnosisDate || null,
          known_triggers: medicalHistory.knownTriggers,
          attack_history: medicalHistory.attackHistory,
          current_symptoms: medicalHistory.currentSymptoms,
          respiratory_issues: medicalHistory.respiratoryIssues,
          allergies: medicalHistory.allergies,
          smoking_status: medicalHistory.smokingStatus,
          family_history: medicalHistory.familyHistory,
          chronic_conditions: medicalHistory.chronicConditions,
        });

      if (medicalError) throw medicalError;

      toast({
        title: 'Registration successful!',
        description: 'Your account has been created. You can now sign in.',
      });

      navigate('/auth');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'Registration failed',
        description: error.message || 'An error occurred during registration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-elevation border-0">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-gradient-hero p-3 rounded-2xl">
            <Activity className="h-8 w-8 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Create Your Account</CardTitle>
        <CardDescription>
          Step {step} of 2: {step === 1 ? 'Personal Information' : 'Medical History'}
        </CardDescription>
        <div className="flex gap-2 mt-4">
          <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 ? (
          <PersonalInfoStep
            data={personalInfo}
            onChange={setPersonalInfo}
          />
        ) : (
          <MedicalHistoryStep
            data={medicalHistory}
            onChange={setMedicalHistory}
          />
        )}

        <div className="flex gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={loading}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex-1 bg-gradient-hero hover:opacity-90"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleRegister}
              disabled={loading}
              className="flex-1 bg-gradient-hero hover:opacity-90"
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
