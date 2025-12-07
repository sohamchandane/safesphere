import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { HeartPulse } from 'lucide-react';

const Register = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="animate-pulse">
          <HeartPulse className="h-12 w-12 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-2xl space-y-4">
        <RegisterForm />
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link to="/auth" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
