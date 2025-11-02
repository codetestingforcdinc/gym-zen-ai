import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, Dumbbell, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [newExercise, setNewExercise] = useState({
    name: "",
    description: "",
    video_url: "",
    category: "",
    difficulty: "beginner",
    target_muscles: "",
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/");
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .single();

    if (!data) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    fetchUsers();
    fetchExercises();
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const usersWithRoles = profilesData?.map(profile => ({
      ...profile,
      role: rolesData?.find(r => r.user_id === profile.id)?.role || "user",
    })) || [];

    setUsers(usersWithRoles);
  };

  const fetchExercises = async () => {
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setExercises(data);
  };

  const toggleAdminRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `User role updated to ${newRole}`,
      });
      fetchUsers();
    }
  };

  const addExercise = async () => {
    const targetMuscles = newExercise.target_muscles.split(",").map(m => m.trim()).filter(m => m);

    const { error } = await supabase.from("exercises").insert({
      name: newExercise.name,
      description: newExercise.description,
      video_url: newExercise.video_url,
      category: newExercise.category,
      difficulty: newExercise.difficulty,
      target_muscles: targetMuscles,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add exercise",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Exercise added successfully",
      });
      setNewExercise({
        name: "",
        description: "",
        video_url: "",
        category: "",
        difficulty: "beginner",
        target_muscles: "",
      });
      fetchExercises();
    }
  };

  const deleteExercise = async (id: string) => {
    const { error } = await supabase
      .from("exercises")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete exercise",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Exercise deleted",
      });
      fetchExercises();
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Portal</h1>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="exercises">Exercise Management</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  All Users
                </CardTitle>
                <CardDescription>Manage user roles and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.age}</TableCell>
                        <TableCell>{user.goal}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                            {user.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAdminRole(user.id, user.role)}
                          >
                            {user.role === "admin" ? "Remove Admin" : "Make Admin"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exercises">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add New Exercise
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Exercise Name</Label>
                      <Input
                        id="name"
                        value={newExercise.name}
                        onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={newExercise.category}
                        onChange={(e) => setNewExercise({ ...newExercise, category: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newExercise.description}
                      onChange={(e) => setNewExercise({ ...newExercise, description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video_url">Video URL (YouTube Embed)</Label>
                    <Input
                      id="video_url"
                      placeholder="https://www.youtube.com/embed/..."
                      value={newExercise.video_url}
                      onChange={(e) => setNewExercise({ ...newExercise, video_url: e.target.value })}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="difficulty">Difficulty</Label>
                      <Input
                        id="difficulty"
                        value={newExercise.difficulty}
                        onChange={(e) => setNewExercise({ ...newExercise, difficulty: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="target_muscles">Target Muscles (comma separated)</Label>
                      <Input
                        id="target_muscles"
                        placeholder="chest, triceps, shoulders"
                        value={newExercise.target_muscles}
                        onChange={(e) => setNewExercise({ ...newExercise, target_muscles: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button onClick={addExercise}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Exercise
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="w-5 h-5" />
                    All Exercises
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exercises.map((exercise) => (
                        <TableRow key={exercise.id}>
                          <TableCell className="font-medium">{exercise.name}</TableCell>
                          <TableCell>{exercise.category}</TableCell>
                          <TableCell>{exercise.difficulty}</TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteExercise(exercise.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
