import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Heart, Moon, Sparkles } from "lucide-react";

const MentalWellness = () => {
  const tips = [
    {
      icon: Brain,
      title: "Mindfulness Meditation",
      description: "Take 10 minutes daily to practice mindfulness. Focus on your breath and be present.",
    },
    {
      icon: Heart,
      title: "Stress Management",
      description: "Regular exercise, adequate sleep, and healthy eating help manage stress levels.",
    },
    {
      icon: Moon,
      title: "Sleep Hygiene",
      description: "Aim for 7-9 hours of quality sleep. Maintain a consistent sleep schedule.",
    },
    {
      icon: Sparkles,
      title: "Positive Mindset",
      description: "Practice gratitude daily. Celebrate small wins and progress.",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mental Wellness</CardTitle>
          <CardDescription>
            Physical fitness and mental health go hand in hand. Here are some tips for your wellbeing.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {tips.map((tip, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-accent">
                  <tip.icon className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">{tip.title}</CardTitle>
                  <CardDescription className="mt-2">{tip.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MentalWellness;
