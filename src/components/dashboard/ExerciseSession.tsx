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
  const [formFeedback, setFormFeedback] = useState<string>("");
  const [incorrectJoints, setIncorrectJoints] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRepStateRef = useRef<"up" | "down">("up");
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    successAudioRef.current = new Audio("/sounds/success.mp3");
    successAudioRef.current.volume = 0.5;
  }, []);

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
          // Set canvas size to match video
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
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

  const playSuccessSound = () => {
    if (successAudioRef.current) {
      successAudioRef.current.currentTime = 0;
      successAudioRef.current.play().catch(err => console.log("Audio play failed:", err));
    }
  };

  const checkForm = (keypoints: any[]) => {
    const incorrect: string[] = [];
    let feedback = "";

    // Get key body points
    const leftHip = keypoints.find(kp => kp.name === "left_hip");
    const rightHip = keypoints.find(kp => kp.name === "right_hip");
    const leftKnee = keypoints.find(kp => kp.name === "left_knee");
    const rightKnee = keypoints.find(kp => kp.name === "right_knee");
    const leftAnkle = keypoints.find(kp => kp.name === "left_ankle");
    const rightAnkle = keypoints.find(kp => kp.name === "right_ankle");
    const leftShoulder = keypoints.find(kp => kp.name === "left_shoulder");
    const rightShoulder = keypoints.find(kp => kp.name === "right_shoulder");

    // Check knee alignment (knees shouldn't go past toes)
    if (leftKnee && leftAnkle && leftKnee.score > 0.3 && leftAnkle.score > 0.3) {
      if (leftKnee.x > leftAnkle.x + 30) {
        incorrect.push("left_knee", "left_ankle");
        feedback = "Keep knees behind toes";
      }
    }

    // Check back alignment (should be straight)
    if (leftShoulder && leftHip && leftShoulder.score > 0.3 && leftHip.score > 0.3) {
      const backAngle = Math.abs(leftShoulder.x - leftHip.x);
      if (backAngle > 50) {
        incorrect.push("left_shoulder", "left_hip");
        feedback = "Keep back straight";
      }
    }

    // Check squat depth
    if (leftHip && leftKnee && leftHip.score > 0.3 && leftKnee.score > 0.3) {
      if (leftHip.y < leftKnee.y - 20) {
        incorrect.push("left_hip", "right_hip", "left_knee", "right_knee");
        feedback = "Go lower - hips below knees";
      }
    }

    setIncorrectJoints(incorrect);
    setFormFeedback(feedback);
  };

  const detectPose = async () => {
    if (!videoRef.current || !detectorRef.current || !isDetecting) return;

    try {
      const poses = await detectorRef.current.estimatePoses(videoRef.current);
      
      if (poses.length > 0) {
        const pose = poses[0];
        const keypoints = pose.keypoints;
        
        // Check form
        checkForm(keypoints);

        // Rep counting logic based on hip height (for squats)
        const leftHip = keypoints.find(kp => kp.name === "left_hip");
        const leftKnee = keypoints.find(kp => kp.name === "left_knee");
        
        if (leftHip && leftKnee && leftHip.score > 0.3 && leftKnee.score > 0.3) {
          const hipKneeDistance = Math.abs(leftHip.y - leftKnee.y);
          
          // Detect rep: standing (up) -> squatting (down) -> standing (up)
          if (hipKneeDistance < 80 && lastRepStateRef.current === "up") {
            lastRepStateRef.current = "down";
          } else if (hipKneeDistance > 120 && lastRepStateRef.current === "down") {
            lastRepStateRef.current = "up";
            setCurrentReps(prev => {
              const newReps = prev + 1;
              playSuccessSound();
              return newReps;
            });
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
        const isIncorrect = incorrectJoints.includes(keypoint.name);
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = isIncorrect ? "#ef4444" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = isIncorrect ? "#ef4444" : "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
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
        const isIncorrect = incorrectJoints.includes(start) || incorrectJoints.includes(end);
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = isIncorrect ? "#ef4444" : "#ffffff";
        ctx.lineWidth = isIncorrect ? 8 : 5;
        ctx.stroke();
      }
    });
  };


  const handleManualRep = () => {
    setCurrentReps(prev => prev + 1);
    playSuccessSound();
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
              <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg"
                  style={{ transform: "scaleX(-1)" }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{ transform: "scaleX(-1)" }}
                />
                
                {/* Rep Counter Circle */}
                <div className="absolute bottom-8 left-8 w-32 h-32 rounded-full border-8 border-white flex items-center justify-center bg-black/30 backdrop-blur-sm">
                  <span className="text-6xl font-bold text-white">{currentReps}</span>
                </div>

                {/* Exercise Name */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                  <h2 className="text-4xl font-bold text-white drop-shadow-lg">{exercise.name}</h2>
                </div>

                {/* Form Feedback */}
                {formFeedback && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full font-semibold text-lg shadow-lg animate-pulse">
                    {formFeedback}
                  </div>
                )}

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-800">
                  <div 
                    className="h-full bg-red-500 transition-all duration-300"
                    style={{ width: `${(currentReps / parseInt(targetReps)) * 100}%` }}
                  />
                </div>

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
