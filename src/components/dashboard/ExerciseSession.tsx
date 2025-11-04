import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle } from "lucide-react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs";
import { motion } from "framer-motion";

interface ExerciseSessionProps {
  exercise: {
    id: string;
    name: string;
    description: string;
    video_url: string;
    category: string;
    difficulty: string;
  };
  open: boolean;
  onClose: () => void;
}

const ExerciseSession = ({ exercise, open, onClose }: ExerciseSessionProps) => {
  const [step, setStep] = useState<"reps" | "exercise" | "complete">("reps");
  const [targetReps, setTargetReps] = useState("");
  const [currentReps, setCurrentReps] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const animationFrameRef = useRef<number>();
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, []);

  const handleStartExercise = () => {
    if (!targetReps || parseInt(targetReps) <= 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid number of reps",
        variant: "destructive",
      });
      return;
    }
    setStep("exercise");
    setIsModelLoading(true);
    setupCamera();
  };

  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          initializePoseDetection();
        };
      }
    } catch (error) {
      toast({
        title: "Camera access denied",
        description: "Please allow camera access to continue",
        variant: "destructive",
      });
    }
  };

  const initializePoseDetection = async () => {
    try {
      await tf.ready();
      const model = poseDetection.SupportedModels.MoveNet;
      const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      };
      detectorRef.current = await poseDetection.createDetector(model, detectorConfig);
      setIsModelLoading(false);
      setIsDetecting(true);
      detectPose();
    } catch (error) {
      console.error("Error initializing pose detection:", error);
      setIsModelLoading(false);
      toast({
        title: "Motion sensing error",
        description: "Failed to initialize motion detection",
        variant: "destructive",
      });
    }
  };

  const detectPose = async () => {
    if (!videoRef.current || !detectorRef.current || !isDetecting) return;

    try {
      const poses = await detectorRef.current.estimatePoses(videoRef.current);
      
      if (poses.length > 0) {
        // Simple rep counting logic based on pose detection
        // This is a simplified version - in production you'd implement proper exercise-specific logic
        const pose = poses[0];
        const keypoints = pose.keypoints;
        
        // Example: Detect if user is in motion (you'd customize this per exercise)
        const leftElbow = keypoints.find(kp => kp.name === "left_elbow");
        const rightElbow = keypoints.find(kp => kp.name === "right_elbow");
        
        if (leftElbow && rightElbow && leftElbow.score && rightElbow.score) {
          if (leftElbow.score > 0.3 && rightElbow.score > 0.3) {
            // Simplified rep detection
            // In production, you'd track movement patterns
          }
        }

        // Draw poses on canvas
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx && videoRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            drawKeypoints(ctx, keypoints);
            drawSkeleton(ctx, keypoints);
          }
        }
      }

      if (currentReps >= parseInt(targetReps)) {
        setIsDetecting(false);
        setStep("complete");
      } else {
        animationFrameRef.current = requestAnimationFrame(detectPose);
      }
    } catch (error) {
      console.error("Error detecting pose:", error);
    }
  };

  const drawKeypoints = (ctx: CanvasRenderingContext2D, keypoints: any[]) => {
    keypoints.forEach((keypoint) => {
      if (keypoint.score && keypoint.score > 0.3) {
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "lime";
        ctx.fill();
      }
    });
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, keypoints: any[]) => {
    const connections = [
      ["left_shoulder", "right_shoulder"],
      ["left_shoulder", "left_elbow"],
      ["left_elbow", "left_wrist"],
      ["right_shoulder", "right_elbow"],
      ["right_elbow", "right_wrist"],
      ["left_hip", "right_hip"],
      ["left_shoulder", "left_hip"],
      ["right_shoulder", "right_hip"],
      ["left_hip", "left_knee"],
      ["left_knee", "left_ankle"],
      ["right_hip", "right_knee"],
      ["right_knee", "right_ankle"],
    ];

    connections.forEach(([start, end]) => {
      const startKp = keypoints.find(kp => kp.name === start);
      const endKp = keypoints.find(kp => kp.name === end);

      if (startKp?.score && endKp?.score && startKp.score > 0.3 && endKp.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = "cyan";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  };


  const handleManualRep = () => {
    setCurrentReps(prev => prev + 1);
  };

  const handleClose = () => {
    setIsDetecting(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setStep("reps");
    setCurrentReps(0);
    setTargetReps("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exercise.name}</DialogTitle>
          <DialogDescription>{exercise.description}</DialogDescription>
        </DialogHeader>

        {step === "reps" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reps">How many reps?</Label>
              <Input
                id="reps"
                type="number"
                min="1"
                value={targetReps}
                onChange={(e) => setTargetReps(e.target.value)}
                placeholder="Enter number of reps"
              />
            </div>
            <Button onClick={handleStartExercise} className="w-full">
              Start Exercise
            </Button>
          </div>
        )}

        {step === "exercise" && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg"
                  style={{ transform: "scaleX(-1)" }}
                />
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ transform: "scaleX(-1)" }}
                />
                {isModelLoading && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <Camera className="w-12 h-12 mx-auto text-white animate-pulse" />
                      <p className="text-white text-sm">Loading motion sensing...</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="w-64 space-y-4">
                <div className="bg-card p-4 rounded-lg border">
                  <h3 className="font-semibold mb-2">Progress</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Reps:</span>
                      <span className="font-bold">{currentReps} / {targetReps}</span>
                    </div>
                    <Progress value={(currentReps / parseInt(targetReps)) * 100} />
                  </div>
                </div>

                <div className="bg-card p-4 rounded-lg border">
                  <h3 className="font-semibold mb-2">Guide</h3>
                  <motion.div
                    className="aspect-video bg-muted rounded-lg flex items-center justify-center"
                    animate={{
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="text-center">
                      <motion.div
                        animate={{
                          y: [0, -10, 0],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                        }}
                        className="text-4xl mb-2"
                      >
                        💪
                      </motion.div>
                      <p className="text-xs text-muted-foreground">Follow the motion</p>
                    </div>
                  </motion.div>
                </div>

                <Button onClick={handleManualRep} variant="outline" className="w-full">
                  Count Rep Manually
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h3 className="text-2xl font-bold">Workout Complete!</h3>
            <p className="text-muted-foreground">
              You completed {currentReps} reps of {exercise.name}
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseSession;
