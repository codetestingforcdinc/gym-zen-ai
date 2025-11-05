import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle } from "lucide-react";
import { Pose } from "@mediapipe/pose";
import { motion } from "framer-motion";

/**
 * ExerciseSession.tsx
 * - Integrates MediaPipe Pose via CDN
 * - Draws skeleton + keypoints on canvas
 * - Highlights incorrect joints in red (based on heuristics)
 * - Rep counting for squat / push-up / jumping jack
 * - Preserves all original UI, toasts, saving history, manual rep button etc.
 */

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
  const poseRef = useRef<Pose | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRepStateRef = useRef<"up" | "down">("up");
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // load audio
  useEffect(() => {
    successAudioRef.current = new Audio("/sounds/success.mp3");
    successAudioRef.current.volume = 0.5;
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (poseRef.current) {
        try { poseRef.current.close(); } catch {}
      }
      // stop camera tracks if any
      if (videoRef.current?.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach(t => t.stop());
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
      // Create MediaPipe Pose instance (CDN files)
      poseRef.current = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      poseRef.current.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      poseRef.current.onResults(onPoseResults);

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

  // angle between points A-B-C (B is center)
  const getAngle = (pointA: any, pointB: any, pointC: any) => {
    const radians = Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x) -
                    Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  const onPoseResults = (results: any) => {
    if (!canvasRef.current || !videoRef.current || !isDetecting) return;

    const canvasCtx = canvasRef.current.getContext("2d");
    if (!canvasCtx) return;

    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;

    // Clear canvas
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // draw mirrored video as background so overlay aligns with flipped video
    // (we are flipping video with CSS scaleX(-1))
    if (results.image) {
      canvasCtx.save();
      // draw image normally — canvas is also flipped via CSS, so just draw
      canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
      canvasCtx.restore();
      // then overlay lines/points
    }

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;

      // Convert normalized coordinates to pixel coordinates
      const keypoints = landmarks.map((landmark: any, index: number) => ({
        x: landmark.x * videoWidth,
        y: landmark.y * videoHeight,
        z: landmark.z,
        visibility: landmark.visibility ?? 1,
        name: getPoseLandmarkName(index),
      }));

      // Check form
      checkForm(keypoints);

      // Draw skeleton then keypoints so points pop
      drawSkeleton(canvasCtx, keypoints);
      drawKeypoints(canvasCtx, keypoints);

      // Rep counting logic
      countReps(keypoints);
    }
  };

  const getPoseLandmarkName = (index: number): string => {
    const landmarkNames = [
      "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner",
      "right_eye", "right_eye_outer", "left_ear", "right_ear", "mouth_left",
      "mouth_right", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
      "left_wrist", "right_wrist", "left_pinky", "right_pinky", "left_index",
      "right_index", "left_thumb", "right_thumb", "left_hip", "right_hip",
      "left_knee", "right_knee", "left_ankle", "right_ankle", "left_heel",
      "right_heel", "left_foot_index", "right_foot_index"
    ];
    return landmarkNames[index] || `landmark_${index}`;
  };

  const countReps = (keypoints: any[]) => {
    const exerciseLower = exercise.name.toLowerCase();

    // --- SQUAT: using hip-knee vertical distance heuristic (pixel based) ---
    if (exerciseLower.includes("squat")) {
      const leftHip = keypoints.find(kp => kp.name === "left_hip");
      const leftKnee = keypoints.find(kp => kp.name === "left_knee");

      if (leftHip && leftKnee && leftHip.visibility > 0.5 && leftKnee.visibility > 0.5) {
        const hipKneeDistance = Math.abs(leftHip.y - leftKnee.y);

        // thresholds are pixel-based; adjust if camera distance changes
        if (hipKneeDistance < 80 && lastRepStateRef.current === "up") {
          lastRepStateRef.current = "down";
        } else if (hipKneeDistance > 120 && lastRepStateRef.current === "down") {
          lastRepStateRef.current = "up";
          setCurrentReps(prev => {
            const newReps = prev + 1;
            playSuccessSound();
            if (newReps >= parseInt(targetReps)) {
              setIsDetecting(false);
              setStep("complete");
              saveWorkoutHistory();
            }
            return newReps;
          });
        }
      }
    }

    // --- PUSH-UP: using elbow angle ---
    else if (exerciseLower.includes("push") || exerciseLower.includes("up")) {
      const leftShoulder = keypoints.find(kp => kp.name === "left_shoulder");
      const leftElbow = keypoints.find(kp => kp.name === "left_elbow");
      const leftWrist = keypoints.find(kp => kp.name === "left_wrist");

      if (leftShoulder && leftElbow && leftWrist &&
          leftShoulder.visibility > 0.5 && leftElbow.visibility > 0.5 && leftWrist.visibility > 0.5) {
        const elbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);

        if (elbowAngle < 100 && lastRepStateRef.current === "up") {
          lastRepStateRef.current = "down";
        } else if (elbowAngle > 160 && lastRepStateRef.current === "down") {
          lastRepStateRef.current = "up";
          setCurrentReps(prev => {
            const newReps = prev + 1;
            playSuccessSound();
            if (newReps >= parseInt(targetReps)) {
              setIsDetecting(false);
              setStep("complete");
              saveWorkoutHistory();
            }
            return newReps;
          });
        }
      }
    }

    // --- JUMPING JACK: arms up + legs spread heuristic ---
    else if (exerciseLower.includes("jack") || exerciseLower.includes("jump")) {
      const leftWrist = keypoints.find(kp => kp.name === "left_wrist");
      const leftShoulder = keypoints.find(kp => kp.name === "left_shoulder");
      const leftAnkle = keypoints.find(kp => kp.name === "left_ankle");
      const rightAnkle = keypoints.find(kp => kp.name === "right_ankle");

      if (leftWrist && leftShoulder && leftAnkle && rightAnkle &&
          leftWrist.visibility > 0.5 && leftShoulder.visibility > 0.5 &&
          leftAnkle.visibility > 0.5 && rightAnkle.visibility > 0.5) {
        const armsUp = leftWrist.y < leftShoulder.y - 50;
        const legsSpread = Math.abs(leftAnkle.x - rightAnkle.x) > 80;

        if (armsUp && legsSpread && lastRepStateRef.current === "down") {
          lastRepStateRef.current = "up";
          setCurrentReps(prev => {
            const newReps = prev + 1;
            playSuccessSound();
            if (newReps >= parseInt(targetReps)) {
              setIsDetecting(false);
              setStep("complete");
              saveWorkoutHistory();
            }
            return newReps;
          });
        } else if (!armsUp && !legsSpread && lastRepStateRef.current === "up") {
          lastRepStateRef.current = "down";
        }
      }
    }
  };

  const checkForm = (keypoints: any[]) => {
    const incorrect: string[] = [];
    let feedback = "";

    const leftHip = keypoints.find(kp => kp.name === "left_hip");
    const rightHip = keypoints.find(kp => kp.name === "right_hip");
    const leftKnee = keypoints.find(kp => kp.name === "left_knee");
    const rightKnee = keypoints.find(kp => kp.name === "right_knee");
    const leftAnkle = keypoints.find(kp => kp.name === "left_ankle");
    const rightAnkle = keypoints.find(kp => kp.name === "right_ankle");
    const leftShoulder = keypoints.find(kp => kp.name === "left_shoulder");
    const rightShoulder = keypoints.find(kp => kp.name === "right_shoulder");
    const leftElbow = keypoints.find(kp => kp.name === "left_elbow");
    const rightElbow = keypoints.find(kp => kp.name === "right_elbow");
    const leftWrist = keypoints.find(kp => kp.name === "left_wrist");
    const rightWrist = keypoints.find(kp => kp.name === "right_wrist");

    const exerciseLower = exercise.name.toLowerCase();

    // simple heuristics - good starting point; can improve with more math
    if (exerciseLower.includes("squat")) {
      if (leftKnee && leftAnkle && leftKnee.visibility > 0.5 && leftAnkle.visibility > 0.5) {
        if (leftKnee.x > leftAnkle.x + 30) {
          incorrect.push("left_knee", "left_ankle");
          feedback = "Keep knees behind toes";
        }
      }

      if (leftShoulder && leftHip && leftShoulder.visibility > 0.5 && leftHip.visibility > 0.5) {
        // horizontal displacement of shoulder vs hip as a proxy for rounding
        const backAngle = Math.abs(leftShoulder.x - leftHip.x);
        if (backAngle > 50) {
          incorrect.push("left_shoulder", "left_hip");
          feedback = "Keep back straight";
        }
      }

      if (leftKnee && rightKnee && leftKnee.visibility > 0.5 && rightKnee.visibility > 0.5) {
        const kneeDistance = Math.abs(leftKnee.x - rightKnee.x);
        if (kneeDistance < 60) {
          incorrect.push("left_knee", "right_knee");
          feedback = "Push knees outward";
        }
      }
    }

    if (exerciseLower.includes("push") || exerciseLower.includes("up")) {
      if (leftShoulder && leftHip && leftAnkle &&
          leftShoulder.visibility > 0.5 && leftHip.visibility > 0.5 && leftAnkle.visibility > 0.5) {
        const shoulderHipAngle = Math.abs(leftShoulder.y - leftHip.y);
        const hipAnkleAngle = Math.abs(leftHip.y - leftAnkle.y);

        if (shoulderHipAngle > 40 || hipAnkleAngle > 40) {
          incorrect.push("left_shoulder", "left_hip", "left_ankle");
          feedback = "Keep body straight";
        }
      }

      if (leftShoulder && leftElbow && leftWrist &&
          leftShoulder.visibility > 0.5 && leftElbow.visibility > 0.5 && leftWrist.visibility > 0.5) {
        const elbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        if (elbowAngle < 70 || elbowAngle > 110) {
          if (elbowAngle < 70) {
            incorrect.push("left_elbow", "left_wrist");
            feedback = "Go lower";
          }
        }
      }
    }

    if (exerciseLower.includes("jack") || exerciseLower.includes("jump")) {
      if (leftWrist && leftShoulder && leftWrist.visibility > 0.5 && leftShoulder.visibility > 0.5) {
        if (leftWrist.y > leftShoulder.y - 50) {
          incorrect.push("left_wrist", "right_wrist");
          feedback = "Raise arms higher";
        }
      }

      if (leftAnkle && rightAnkle && leftAnkle.visibility > 0.5 && rightAnkle.visibility > 0.5) {
        const legSpread = Math.abs(leftAnkle.x - rightAnkle.x);
        if (legSpread < 80) {
          incorrect.push("left_ankle", "right_ankle");
          feedback = "Spread legs wider";
        }
      }
    }

    setIncorrectJoints(incorrect);
    setFormFeedback(feedback);
  };

  const detectPose = async () => {
    if (!videoRef.current || !poseRef.current || !isDetecting) return;

    try {
      await poseRef.current.send({ image: videoRef.current });
      animationFrameRef.current = requestAnimationFrame(detectPose);
    } catch (error) {
      console.error("Error detecting pose:", error);
      if (isDetecting) {
        animationFrameRef.current = requestAnimationFrame(detectPose);
      }
    }
  };

  const drawKeypoints = (ctx: CanvasRenderingContext2D, keypoints: any[]) => {
    keypoints.forEach((keypoint) => {
      if (keypoint.visibility && keypoint.visibility > 0.5) {
        const isIncorrect = incorrectJoints.includes(keypoint.name);
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = isIncorrect ? "#ef4444" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = isIncorrect ? "#ef4444" : "#ffffff";
        ctx.lineWidth = 3;
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

      if (startKp?.visibility && endKp?.visibility && startKp.visibility > 0.5 && endKp.visibility > 0.5) {
        const isIncorrect = incorrectJoints.includes(start) || incorrectJoints.includes(end);
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = isIncorrect ? "#ef4444" : "#ffffff";
        ctx.lineWidth = isIncorrect ? 10 : 6;
        ctx.stroke();
      }
    });
  };


  const saveWorkoutHistory = () => {
    const workoutData = {
      exerciseName: exercise.name,
      reps: currentReps,
      targetReps: parseInt(targetReps),
      date: new Date().toISOString(),
      difficulty: exercise.difficulty,
      category: exercise.category,
    };

    const history = JSON.parse(localStorage.getItem("workoutHistory") || "[]");
    history.push(workoutData);
    localStorage.setItem("workoutHistory", JSON.stringify(history));

    toast({
      title: "Workout saved!",
      description: `${currentReps} reps of ${exercise.name} recorded`,
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
    if (poseRef.current) {
      try { poseRef.current.close(); } catch {}
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
                    style={{ width: `${(currentReps / (parseInt(targetReps) || 1)) * 100}%` }}
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
                    <Progress value={(currentReps / (parseInt(targetReps) || 1)) * 100} />
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
