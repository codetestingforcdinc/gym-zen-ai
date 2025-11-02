import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dumbbell, Target, Sparkles, Heart } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8 mb-16">
          <div className="flex justify-center mb-6">
            <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm">
              <Dumbbell className="w-16 h-16 text-white" />
            </div>
          </div>
          
          <h1 className="text-6xl font-bold text-white mb-4">
            FitAI
          </h1>
          <p className="text-2xl text-white/90 max-w-2xl mx-auto">
            Your Personal AI-Powered Home Training Companion
          </p>
          
          <div className="flex gap-4 justify-center mt-8">
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6"
              onClick={() => navigate("/auth")}
            >
              Get Started
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
            <div className="p-3 rounded-lg bg-white/20 w-fit mb-4">
              <Target className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Personalized Training</h3>
            <p className="text-white/80">
              AI-powered workout plans tailored to your goals, with video tutorials for every exercise
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
            <div className="p-3 rounded-lg bg-white/20 w-fit mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Smart Nutrition</h3>
            <p className="text-white/80">
              AI-generated meal plans and image-based calorie tracking to fuel your progress
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
            <div className="p-3 rounded-lg bg-white/20 w-fit mb-4">
              <Heart className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Complete Wellness</h3>
            <p className="text-white/80">
              Injury prevention tips, mental wellness support, and professional help when needed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
