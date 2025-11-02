import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Dumbbell, Apple, Stethoscope } from "lucide-react";

const ProfessionalHelp = () => {
  const handleFindNearby = (type: string) => {
    // This would integrate with location services in a full implementation
    alert(`Finding ${type} near you... (Location services to be integrated)`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Professional Help
          </CardTitle>
          <CardDescription>
            Find nearby professionals to support your fitness journey
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Dumbbell className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Nearby Gyms</CardTitle>
            </div>
            <CardDescription>Find gyms and fitness centers in your area</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => handleFindNearby("gyms")}>
              <MapPin className="w-4 h-4 mr-2" />
              Find Gyms
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Apple className="w-6 h-6 text-secondary" />
              </div>
              <CardTitle className="text-lg">Nutritionists</CardTitle>
            </div>
            <CardDescription>Connect with certified nutritionists</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => handleFindNearby("nutritionists")}>
              <MapPin className="w-4 h-4 mr-2" />
              Find Nutritionists
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-accent/10">
                <Stethoscope className="w-6 h-6 text-accent" />
              </div>
              <CardTitle className="text-lg">Health Consultants</CardTitle>
            </div>
            <CardDescription>Get professional health advice</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => handleFindNearby("health consultants")}>
              <MapPin className="w-4 h-4 mr-2" />
              Find Consultants
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Important Note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Location services will be integrated in the next phase. These features will help you find certified
            professionals near you to support your fitness goals with personalized guidance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfessionalHelp;
