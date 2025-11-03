import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dumbbell, LogOut } from "lucide-react";
import Profile from "@/components/dashboard/Profile";
import Exercise from "@/components/dashboard/Exercise";
import MentalWellness from "@/components/dashboard/MentalWellness";
import DietNutrition from "@/components/dashboard/DietNutrition";
import ProfessionalHelp from "@/components/dashboard/ProfessionalHelp";
import { AdDisplay } from "@/components/AdDisplay";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/");
        return;
      }
      setUser(session.user);
      checkAdminStatus(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/");
        return;
      }
      setUser(session.user);
      checkAdminStatus(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    setIsAdmin(!!data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary">
              <Dumbbell className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">FitAI</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                Admin Portal
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <AdDisplay />
        </div>
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="exercise">Exercise</TabsTrigger>
            <TabsTrigger value="mental">Mental Wellness</TabsTrigger>
            <TabsTrigger value="diet">Diet & Nutrition</TabsTrigger>
            <TabsTrigger value="help">Professional Help</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Profile userId={user.id} />
          </TabsContent>

          <TabsContent value="exercise">
            <Exercise userId={user.id} />
          </TabsContent>

          <TabsContent value="mental">
            <MentalWellness />
          </TabsContent>

          <TabsContent value="diet">
            <DietNutrition userId={user.id} />
          </TabsContent>

          <TabsContent value="help">
            <ProfessionalHelp />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
