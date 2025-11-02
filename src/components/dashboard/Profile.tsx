import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { User } from "lucide-react";

interface ProfileProps {
  userId: string;
}

const Profile = ({ userId }: ProfileProps) => {
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
      return;
    }

    setProfile(data);
  };

  const handleUpdate = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: profile.name,
        age: parseInt(profile.age),
        weight: parseFloat(profile.weight),
        diet: profile.diet,
        additional_diet_preferences: profile.additional_diet_preferences,
        goal: profile.goal,
        health_conditions: profile.health_conditions,
      })
      .eq("id", userId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      setEditing(false);
    }
    setLoading(false);
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Your Profile
        </CardTitle>
        <CardDescription>View and edit your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            disabled={!editing}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              value={profile.age}
              onChange={(e) => setProfile({ ...profile, age: e.target.value })}
              disabled={!editing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={profile.weight}
              onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
              disabled={!editing}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="diet">Diet Type</Label>
          <Select
            value={profile.diet}
            onValueChange={(value) => setProfile({ ...profile, diet: value })}
            disabled={!editing}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vegetarian">Vegetarian</SelectItem>
              <SelectItem value="vegan">Vegan</SelectItem>
              <SelectItem value="non_vegetarian">Non-Vegetarian</SelectItem>
              <SelectItem value="pescatarian">Pescatarian</SelectItem>
              <SelectItem value="keto">Keto</SelectItem>
              <SelectItem value="paleo">Paleo</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="additional_diet_preferences">Additional Diet Preferences</Label>
          <Input
            id="additional_diet_preferences"
            value={profile.additional_diet_preferences || ""}
            onChange={(e) => setProfile({ ...profile, additional_diet_preferences: e.target.value })}
            disabled={!editing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal">Fitness Goal</Label>
          <Input
            id="goal"
            value={profile.goal}
            onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
            disabled={!editing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="health_conditions">Health Conditions</Label>
          <Textarea
            id="health_conditions"
            value={profile.health_conditions || ""}
            onChange={(e) => setProfile({ ...profile, health_conditions: e.target.value })}
            disabled={!editing}
          />
        </div>

        <div className="flex gap-2">
          {!editing ? (
            <Button onClick={() => setEditing(true)}>Edit Profile</Button>
          ) : (
            <>
              <Button onClick={handleUpdate} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => { setEditing(false); fetchProfile(); }}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Profile;
