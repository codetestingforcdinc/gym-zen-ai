import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Apple, Camera, FileText, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DietNutritionProps {
  userId: string;
}

const DietNutrition = ({ userId }: DietNutritionProps) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Apple className="w-5 h-5" />
            Diet & Nutrition
          </CardTitle>
          <CardDescription>Track your meals and get personalized nutrition advice</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">AI Calorie Tracker</CardTitle>
            </div>
            <CardDescription>Upload food images to track calories automatically</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              <Camera className="w-4 h-4 mr-2" />
              Upload Food Image
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Coming soon: AI-powered image analysis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-secondary" />
              <CardTitle className="text-lg">AI Meal Plan</CardTitle>
            </div>
            <CardDescription>Get personalized meal plans based on your goals</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Generate Meal Plan
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Coming soon: AI-generated meal plans
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nutrition Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Protein</h4>
            <p className="text-sm text-muted-foreground">
              Aim for 1.6-2.2g per kg of body weight for muscle building
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Carbohydrates</h4>
            <p className="text-sm text-muted-foreground">
              Primary energy source, especially important around workouts
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Healthy Fats</h4>
            <p className="text-sm text-muted-foreground">
              Essential for hormone production and overall health
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Hydration</h4>
            <p className="text-sm text-muted-foreground">
              Drink at least 2-3 liters of water daily, more during exercise
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DietNutrition;
