import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, Play } from "lucide-react";
import { motion } from "framer-motion";
import ExerciseSession from "./ExerciseSession";

interface ExerciseProps {
  userId: string;
}

const Exercise = ({ userId }: ExerciseProps) => {
  const [exercises, setExercises] = useState<any[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<any | null>(null);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .order("category");

    if (!error && data) {
      setExercises(data);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            Available Exercises
          </CardTitle>
          <CardDescription>Choose exercises to start your workout</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {exercises.map((exercise) => (
          <Card key={exercise.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <motion.div 
              className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 relative overflow-hidden cursor-pointer"
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedExercise(exercise)}
            >
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <div className="text-6xl">💪</div>
              </motion.div>
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Play className="w-16 h-16 text-white" />
              </div>
            </motion.div>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{exercise.name}</CardTitle>
                <Badge variant={exercise.difficulty === 'beginner' ? 'secondary' : exercise.difficulty === 'intermediate' ? 'default' : 'destructive'}>
                  {exercise.difficulty}
                </Badge>
              </div>
              <CardDescription>{exercise.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Category:</span>
                  <Badge variant="outline">{exercise.category}</Badge>
                </div>
                {exercise.target_muscles && exercise.target_muscles.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Targets:</span>
                    {exercise.target_muscles.map((muscle: string) => (
                      <Badge key={muscle} variant="outline" className="text-xs">
                        {muscle}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button 
                  className="w-full mt-2" 
                  onClick={() => setSelectedExercise(exercise)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Exercise
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedExercise && (
        <ExerciseSession
          exercise={selectedExercise}
          open={!!selectedExercise}
          onClose={() => setSelectedExercise(null)}
        />
      )}
    </div>
  );
};

export default Exercise;
