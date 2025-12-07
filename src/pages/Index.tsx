import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Activity, Heart, Shield, TrendingUp } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl font-bold text-foreground leading-tight">
            Predict Asthma Attacks<br />
            <span className="bg-gradient-hero bg-clip-text text-transparent">
              Before They Happen
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Real-time environmental monitoring and AI-powered predictions to help you stay ahead of asthma triggers and breathe easier.
          </p>

          <div className="flex gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              className="h-12 px-8 bg-gradient-hero hover:opacity-90 text-lg"
              onClick={() => navigate('/register')}
            >
              Get Started
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="h-12 px-8 text-lg"
              onClick={() => navigate('/auth')}
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-card rounded-2xl p-6 shadow-soft border border-border">
            <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <Heart className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-Time Monitoring</h3>
            <p className="text-muted-foreground">
              Track heart rate via smartwatch and environmental factors including weather, air quality, and pollen levels.
            </p>
          </div>

          <div className="bg-card rounded-2xl p-6 shadow-soft border border-border">
            <div className="bg-accent/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Predictions</h3>
            <p className="text-muted-foreground">
              Advanced deep learning models analyze patterns to predict asthma attack risk with high accuracy.
            </p>
          </div>

          <div className="bg-card rounded-2xl p-6 shadow-soft border border-border">
            <div className="bg-success/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-success" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Medical Privacy</h3>
            <p className="text-muted-foreground">
              Your health data is encrypted and protected with medical-grade security standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
