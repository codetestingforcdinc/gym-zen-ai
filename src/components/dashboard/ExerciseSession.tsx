import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle } from "lucide-react";
import type { Pose as PoseType } from "@mediapipe/pose";
import { motion } from "framer-motion";

/**
 * ExerciseSession.tsx
 * - Integrates MediaPipe Pose with robust initialization and fallback
 * - Draws skeleton + keypoints on canvas
 * - Highlights incorrect joints in red based on heuristics
 * - Angle-based detection & rep counting for:
 *   Squats, Push-ups, Pull-ups, Planks (hold feedback), Lunges
 * - Preserves your UI, toasts, saving history, manual rep button etc.
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

type LandmarkKey =
  | "nose" | "left_eye_inner" | "left_eye" | "left_eye_outer" | "right_eye_inner"
  | "right_eye" | "right_eye_outer" | "left_ear" | "right_ear" | "mouth_left"
  | "mouth_right" | "left_shoulder" | "right_shoulder" | "left_elbow" | "right_elbow"
  | "left_wrist" | "right_wrist" | "left_pinky" | "right_pinky" | "left_index"
  | "right_index" | "left_thumb" | "right_thumb" | "left_hip" | "right_hip"
  | "left_knee" | "right_knee" | "left_ankle" | "right_ankle" | "left_heel"
  | "right_heel" | "left_foot_index" | "right_foot_index";

const landmarkNames: LandmarkKey[] = [
  "nose","left_eye_inner","left_eye","left_eye_outer","right_eye_inner","right_eye",
  "right_eye_outer","left_ear","right_ear","mouth_left","mouth_right","left_shoulder",
  "right_shoulder","left_elbow","right_elbow","left_wrist","right_wrist","left_pinky",
  "right_pinky","left_index","right_index","left_thumb","right_thumb","left_hip",
  "right_hip","left_knee","right_knee","left_ankle","right_ankle","left_heel",
  "right_heel","left_foot_index","right_foot_index"
];

const ExerciseSession = ({ exercise, open, onClose }: ExerciseSessionProps) => {
  const [step, setStep] = useState<"reps" | "exercise" | "complete">("reps");
  const [targetReps, setTargetReps] = useState("");
  const [currentReps, setCurrentReps] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [formFeedback, setFormFeedback] = useState<string>("");
  const [incorrectJoints, setIncorrectJoints] = useState<string[]>([]);
  const [initError, setInitError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<any /* PoseType */ | null>(null);
  const cameraUtilRef = useRef<any | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRepStateRef = useRef<"up" | "down">("up");
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Comprehensive thresholds for all exercises with angular perfection
  const thresholds = {
    squat: { 
      hipKneeDown: 80, 
      hipKneeUp: 120,
      kneeAnglePerfect: 90,  // perfect squat depth
      hipAnglePerfect: 90,   // hip flexion
      backAngleMin: 45,      // minimum back angle
      kneeAlignmentTolerance: 15
    },
    pushup: { 
      elbowDown: 90, 
      elbowUp: 160,
      elbowAnglePerfect: 90,  // perfect push-up depth
      bodyAlignmentAngle: 170, // straight body line
      shoulderAnglePerfect: 90
    },
    pullup: { 
      elbowDown: 70, 
      elbowUp: 150,
      elbowAnglePerfect: 45,  // chin over bar
      shoulderEngagement: 30
    },
    lunge: { 
      kneeDown: 85, 
      kneeUp: 150,
      frontKneeAnglePerfect: 90,
      backKneeAnglePerfect: 90,
      torsoAngleMin: 80
    },
    plank: { 
      hipShoulderMin: 160,
      bodyAlignmentPerfect: 180, // perfectly straight
      elbowAngle: 90
    },
    jumpingjack: {
      armAngleUp: 160,      // arms overhead
      armAngleDown: 30,     // arms at sides
      legSpreadAngle: 40    // leg separation
    }
  };

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
    setInitError(null);
    setupCamera();
  };

  const setupCamera = async () => {
    try {
      // Request camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      if (!videoRef.current) throw new Error("Video element not found");

      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        try {
          videoRef.current!.play();
        } catch (e) {
          console.warn("Video play failed:", e);
        }
        // Set canvas to video size
        if (canvasRef.current && videoRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
        }
        initializePoseDetection();
      };
    } catch (err: any) {
      console.error("Camera setup error:", err);
      setIsModelLoading(false);
      setInitError("Camera permission denied or camera not available.");
      toast({
        title: "Camera access denied",
        description: "Please allow camera access to continue",
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

  // Helper: angle between A-B-C (B center)
  const getAngle = (pointA: any, pointB: any, pointC: any) => {
    if (!pointA || !pointB || !pointC) return 0;
    const radians = Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x) -
                    Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  // Robust initialization: try to use Pose directly; if fails, dynamic import fallback
  const initializePoseDetection = async () => {
    setInitError(null);
    try {
      // Import MediaPipe Pose and Camera utilities
      const { Pose } = await import("@mediapipe/pose");
      let Camera: any = null;

      try {
        const cameraModule = await import("@mediapipe/camera_utils");
        Camera = cameraModule.Camera;
      } catch (err) {
        console.warn("Camera utils not available, using manual loop:", err);
      }

      // instantiate pose
      poseRef.current = new Pose({
        locateFile: (file: string) => {
          // prefer CDN if bundler doesn't supply assets
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        },
      });

      // set options
      poseRef.current.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // bind results handler
      poseRef.current.onResults(onPoseResults);

      setIsModelLoading(false);
      setIsDetecting(true);

      // If Camera available, use it to handle frames; else run manual loop
      if (Camera && videoRef.current) {
        try {
          // store camera util for potential cleanup
          cameraUtilRef.current = new Camera(videoRef.current, {
            onFrame: async () => {
              try {
                await poseRef.current.send({ image: videoRef.current });
              } catch (e) {
                console.error("pose.send error (Camera):", e);
              }
            },
            width: 640,
            height: 480,
          });
          // start camera util
          await cameraUtilRef.current.start();
        } catch (camErr) {
          console.warn("Camera start failed, falling back to manual loop:", camErr);
          detectPose(); // fallback
        }
      } else {
        // fallback manual detect loop (works in most cases)
        detectPose();
      }
    } catch (error: any) {
      console.error("Error initializing pose detection:", error);
      setIsModelLoading(false);
      setInitError(error?.message || "Failed to initialize motion detection.");
      toast({
        title: "Motion sensing error",
        description: error?.message || "Failed to initialize motion detection",
        variant: "destructive",
      });
    }
  };

  // detectPose loop (manual fallback)
  const detectPose = async () => {
    if (!videoRef.current || !poseRef.current || !isDetecting) return;
    try {
      await poseRef.current.send({ image: videoRef.current });
    } catch (err) {
      console.error("detectPose: pose.send error:", err);
    } finally {
      animationFrameRef.current = requestAnimationFrame(detectPose);
    }
  };

  // onPoseResults: called by MediaPipe when new landmarks are available
  const onPoseResults = (results: any) => {
    if (!canvasRef.current || !videoRef.current || !isDetecting) return;

    const canvasCtx = canvasRef.current.getContext("2d");
    if (!canvasCtx) return;

    const videoWidth = videoRef.current.videoWidth || canvasRef.current.width;
    const videoHeight = videoRef.current.videoHeight || canvasRef.current.height;

    // Clear canvas
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // draw video frame as background (canvas is mirrored by CSS)
    if (results.image) {
      try {
        canvasCtx.save();
        // draw image to full canvas
        canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasCtx.restore();
      } catch (e) {
        // drawing might fail on cross-origin issues — ignore but log
        console.warn("drawImage failed on canvas:", e);
      }
    }

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;

      // Convert normalized coords to pixel coords
      const keypoints = landmarks.map((landmark: any, index: number) => ({
        x: (landmark.x ?? 0) * videoWidth,
        y: (landmark.y ?? 0) * videoHeight,
        z: landmark.z ?? 0,
        visibility: landmark.visibility ?? 0,
        name: landmarkNames[index] ?? `landmark_${index}`,
      }));

      // Check form (sets incorrect joints & feedback)
      checkForm(keypoints);

      // Draw skeleton and keypoints
      drawSkeleton(canvasCtx, keypoints);
      drawKeypoints(canvasCtx, keypoints);

      // Rep counting and exercise-specific logic
      countReps(keypoints);
    }
  };

  const getPoseLandmarkName = (index: number): string => {
    return landmarkNames[index] || `landmark_${index}`;
  };

  // Count reps — extended to include lunges, pull-ups, planks (plank won't count reps, it gives hold feedback)
  const countReps = (keypoints: any[]) => {
    const exerciseLower = exercise.name.toLowerCase();

    // helper to find landmark
    const L = (name: string) => keypoints.find(kp => kp.name === name);

    // --- SQUAT: hip-knee vertical distance heuristic (pixel-based) ---
    if (exerciseLower.includes("squat")) {
      const leftHip = L("left_hip");
      const leftKnee = L("left_knee");
      if (leftHip && leftKnee && leftHip.visibility > 0.4 && leftKnee.visibility > 0.4) {
        const hipKneeDistance = Math.abs(leftHip.y - leftKnee.y);
        if (hipKneeDistance < thresholds.squat.hipKneeDown && lastRepStateRef.current === "up") {
          lastRepStateRef.current = "down";
        } else if (hipKneeDistance > thresholds.squat.hipKneeUp && lastRepStateRef.current === "down") {
          lastRepStateRef.current = "up";
          incrementReps();
        }
      }
    }

    // --- PUSH-UP: elbow angle ---
    else if (exerciseLower.includes("push") || (exerciseLower.includes("up") && exerciseLower.includes("push"))) {
      const leftShoulder = L("left_shoulder");
      const leftElbow = L("left_elbow");
      const leftWrist = L("left_wrist");
      if (leftShoulder && leftElbow && leftWrist &&
          leftShoulder.visibility > 0.4 && leftElbow.visibility > 0.4 && leftWrist.visibility > 0.4) {
        const elbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        if (elbowAngle < thresholds.pushup.elbowDown && lastRepStateRef.current === "up") {
          lastRepStateRef.current = "down";
        } else if (elbowAngle > thresholds.pushup.elbowUp && lastRepStateRef.current === "down") {
          lastRepStateRef.current = "up";
          incrementReps();
        }
      }
    }

    // --- PULL-UP: elbow angle & shoulder movement (top = elbows bent) ---
    else if (exerciseLower.includes("pull")) {
      const leftShoulder = L("left_shoulder");
      const leftElbow = L("left_elbow");
      const leftWrist = L("left_wrist");
      if (leftShoulder && leftElbow && leftWrist &&
          leftShoulder.visibility > 0.4 && leftElbow.visibility > 0.4 && leftWrist.visibility > 0.4) {
        const elbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        // top of pull-up (chin over bar) => elbow angle small (flexed)
        if (elbowAngle < thresholds.pullup.elbowDown && lastRepStateRef.current === "up") {
          lastRepStateRef.current = "down";
        } else if (elbowAngle > thresholds.pullup.elbowUp && lastRepStateRef.current === "down") {
          lastRepStateRef.current = "up";
          incrementReps();
        }
      }
    }

    // --- LUNGE: front-knee angle similar to squat (single-leg) ---
    else if (exerciseLower.includes("lunge")) {
      // use left leg as primary
      const leftHip = L("left_hip");
      const leftKnee = L("left_knee");
      const leftAnkle = L("left_ankle");
      if (leftHip && leftKnee && leftAnkle &&
          leftHip.visibility > 0.4 && leftKnee.visibility > 0.4 && leftAnkle.visibility > 0.4) {
        const kneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
        if (kneeAngle < thresholds.lunge.kneeDown && lastRepStateRef.current === "up") {
          lastRepStateRef.current = "down";
        } else if (kneeAngle > thresholds.lunge.kneeUp && lastRepStateRef.current === "down") {
          lastRepStateRef.current = "up";
          incrementReps();
        }
      }
    }

    // --- JUMPING JACK existing logic kept above in original code (unchanged if present) ---
    else if (exerciseLower.includes("jack") || exerciseLower.includes("jump")) {
      // original jack logic still active in your code path if exercise name includes 'jack'/'jump'
      const leftWrist = L("left_wrist");
      const leftShoulder = L("left_shoulder");
      const leftAnkle = L("left_ankle");
      const rightAnkle = L("right_ankle");

      if (leftWrist && leftShoulder && leftAnkle && rightAnkle &&
          leftWrist.visibility > 0.4 && leftShoulder.visibility > 0.4 &&
          leftAnkle.visibility > 0.4 && rightAnkle.visibility > 0.4) {
        const armsUp = leftWrist.y < leftShoulder.y - 50;
        const legsSpread = Math.abs(leftAnkle.x - rightAnkle.x) > 80;

        if (armsUp && legsSpread && lastRepStateRef.current === "down") {
          lastRepStateRef.current = "up";
          incrementReps();
        } else if (!armsUp && !legsSpread && lastRepStateRef.current === "up") {
          lastRepStateRef.current = "down";
        }
      }
    }

    // PLANK is treated as hold — we display feedback in checkForm; no reps increment
  };

  const incrementReps = () => {
    setCurrentReps(prev => {
      const newReps = prev + 1;
      playSuccessSound();
      if (newReps >= parseInt(targetReps || "0")) {
        setIsDetecting(false);
        setStep("complete");
        saveWorkoutHistory();
      }
      return newReps;
    });
  };

  // Comprehensive form checks with angular perfection for ALL exercises
  const checkForm = (keypoints: any[]) => {
    const incorrect: string[] = [];
    let feedback = "";

    const L = (name: string) => keypoints.find(kp => kp.name === name);

    const leftHip = L("left_hip");
    const rightHip = L("right_hip");
    const leftKnee = L("left_knee");
    const rightKnee = L("right_knee");
    const leftAnkle = L("left_ankle");
    const rightAnkle = L("right_ankle");
    const leftShoulder = L("left_shoulder");
    const rightShoulder = L("right_shoulder");
    const leftElbow = L("left_elbow");
    const rightElbow = L("right_elbow");
    const leftWrist = L("left_wrist");
    const rightWrist = L("right_wrist");

    const exerciseLower = exercise.name.toLowerCase();

    // SQUAT - Angular perfection checks
    if (exerciseLower.includes("squat")) {
      // Check knee angle (hip-knee-ankle)
      if (leftHip && leftKnee && leftAnkle && 
          leftHip.visibility > 0.4 && leftKnee.visibility > 0.4 && leftAnkle.visibility > 0.4) {
        const kneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
        
        if (kneeAngle < 70) {
          incorrect.push("left_knee", "left_hip", "left_ankle");
          feedback = "Squat too deep - protect knees";
        } else if (kneeAngle > 110) {
          incorrect.push("left_knee", "left_hip");
          feedback = "Go deeper - aim for 90° knee angle";
        }
        
        // Knee alignment - knees should track over toes
        if (leftKnee.x > leftAnkle.x + 30) {
          incorrect.push("left_knee", "left_ankle");
          feedback = "Keep knees behind toes";
        }
      }

      // Check hip angle (shoulder-hip-knee)
      if (leftShoulder && leftHip && leftKnee && 
          leftShoulder.visibility > 0.4 && leftHip.visibility > 0.4 && leftKnee.visibility > 0.4) {
        const hipAngle = getAngle(leftShoulder, leftHip, leftKnee);
        
        if (hipAngle < 70) {
          incorrect.push("left_hip", "left_shoulder", "left_knee");
          feedback = "Hips too low - maintain hip angle";
        }
      }

      // Check back alignment (shoulder-hip horizontal)
      if (leftShoulder && leftHip && leftShoulder.visibility > 0.4 && leftHip.visibility > 0.4) {
        const backTilt = Math.abs(leftShoulder.x - leftHip.x);
        if (backTilt > 60) {
          incorrect.push("left_shoulder", "left_hip");
          feedback = "Keep back straight & chest up";
        }
      }

      // Check knee width (valgus/varus)
      if (leftKnee && rightKnee && leftKnee.visibility > 0.4 && rightKnee.visibility > 0.4) {
        const kneeDistance = Math.abs(leftKnee.x - rightKnee.x);
        if (kneeDistance < 60) {
          incorrect.push("left_knee", "right_knee");
          feedback = "Push knees outward - hip width";
        }
      }
    }

    // PUSH-UP - Angular perfection checks
    if (exerciseLower.includes("push") || (exerciseLower.includes("up") && exerciseLower.includes("push"))) {
      // Check body alignment (shoulder-hip-ankle should be straight)
      if (leftShoulder && leftHip && leftAnkle &&
          leftShoulder.visibility > 0.4 && leftHip.visibility > 0.4 && leftAnkle.visibility > 0.4) {
        const bodyAngle = getAngle(leftShoulder, leftHip, leftAnkle);
        
        if (bodyAngle < 160) {
          incorrect.push("left_shoulder", "left_hip", "left_ankle");
          feedback = "Keep body straight - plank position";
        }
        
        // Check for sagging hips
        const shoulderHipDiff = Math.abs(leftShoulder.y - leftHip.y);
        const hipAnkleDiff = Math.abs(leftHip.y - leftAnkle.y);
        if (shoulderHipDiff > 50 || hipAnkleDiff > 50) {
          incorrect.push("left_hip");
          feedback = "Don't let hips sag";
        }
      }

      // Check elbow angle (shoulder-elbow-wrist)
      if (leftShoulder && leftElbow && leftWrist &&
          leftShoulder.visibility > 0.4 && leftElbow.visibility > 0.4 && leftWrist.visibility > 0.4) {
        const elbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        
        if (elbowAngle < 70) {
          incorrect.push("left_elbow", "left_wrist", "left_shoulder");
          feedback = "Go deeper - chest to ground";
        } else if (elbowAngle > 170) {
          incorrect.push("left_elbow");
          feedback = "Lock out at top";
        }
        
        // Check elbow flare (should be ~45° from body)
        if (leftElbow && leftShoulder && leftElbow.visibility > 0.4) {
          const elbowFlare = Math.abs(leftElbow.x - leftShoulder.x);
          if (elbowFlare > 80) {
            incorrect.push("left_elbow", "left_shoulder");
            feedback = "Keep elbows tucked - 45° angle";
          }
        }
      }
    }

    // PULL-UP - Angular perfection checks
    if (exerciseLower.includes("pull")) {
      // Check elbow angle (shoulder-elbow-wrist) - full range of motion
      if (leftShoulder && leftElbow && leftWrist &&
          leftShoulder.visibility > 0.4 && leftElbow.visibility > 0.4 && leftWrist.visibility > 0.4) {
        const elbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        
        if (elbowAngle < 40) {
          incorrect.push("left_elbow", "left_shoulder", "left_wrist");
          feedback = "Perfect pull! Chin over bar";
        } else if (elbowAngle > 160) {
          incorrect.push("left_elbow", "left_shoulder");
          feedback = "Pull higher - chin over bar";
        } else if (elbowAngle > 100 && elbowAngle < 140) {
          incorrect.push("left_elbow");
          feedback = "Full range - pull all the way up";
        }
      }

      // Check shoulder engagement angle
      if (leftShoulder && leftElbow && leftShoulder.visibility > 0.4 && leftElbow.visibility > 0.4) {
        const shoulderEngagement = Math.abs(leftShoulder.y - leftElbow.y);
        if (shoulderEngagement < 30) {
          incorrect.push("left_shoulder", "left_elbow");
          feedback = "Engage shoulders - don't hang";
        }
      }

      // Check for swinging/kipping (hip stability)
      if (leftHip && rightHip && leftHip.visibility > 0.4 && rightHip.visibility > 0.4) {
        const hipShift = Math.abs(leftHip.x - rightHip.x);
        if (hipShift > 100) {
          incorrect.push("left_hip", "right_hip");
          feedback = "Stop swinging - strict form";
        }
      }

      // Check body alignment (no excessive arch)
      if (leftShoulder && leftHip && leftKnee &&
          leftShoulder.visibility > 0.4 && leftHip.visibility > 0.4 && leftKnee.visibility > 0.4) {
        const bodyArch = getAngle(leftShoulder, leftHip, leftKnee);
        if (bodyArch < 140) {
          incorrect.push("left_hip", "left_knee");
          feedback = "Keep body straight - don't arch";
        }
      }
    }

    // LUNGE - Angular perfection checks
    if (exerciseLower.includes("lunge")) {
      // Check front knee angle (hip-knee-ankle) - should be ~90°
      if (leftHip && leftKnee && leftAnkle && 
          leftHip.visibility > 0.4 && leftKnee.visibility > 0.4 && leftAnkle.visibility > 0.4) {
        const frontKneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
        
        if (frontKneeAngle < 70) {
          incorrect.push("left_knee", "left_hip", "left_ankle");
          feedback = "Don't go too deep - 90° knee angle";
        } else if (frontKneeAngle > 110) {
          incorrect.push("left_knee");
          feedback = "Lower down - aim for 90° angle";
        }
        
        // Front knee alignment - should not pass toes
        if (leftKnee.x > leftAnkle.x + 30) {
          incorrect.push("left_knee", "left_ankle");
          feedback = "Keep front knee behind toes";
        }
      }

      // Check back knee angle (should also be ~90°)
      if (rightHip && rightKnee && rightAnkle && 
          rightHip.visibility > 0.4 && rightKnee.visibility > 0.4 && rightAnkle.visibility > 0.4) {
        const backKneeAngle = getAngle(rightHip, rightKnee, rightAnkle);
        
        if (backKneeAngle > 110) {
          incorrect.push("right_knee", "right_hip");
          feedback = "Lower back knee closer to ground";
        }
      }

      // Check torso angle (shoulder-hip should be upright)
      if (leftShoulder && leftHip && leftShoulder.visibility > 0.4 && leftHip.visibility > 0.4) {
        const torsoTilt = Math.abs(leftShoulder.x - leftHip.x);
        if (torsoTilt > 50) {
          incorrect.push("left_shoulder", "left_hip");
          feedback = "Keep torso upright & vertical";
        }
        
        // Check forward lean
        const shoulderHipAngle = Math.abs(leftShoulder.y - leftHip.y);
        if (shoulderHipAngle < 40) {
          incorrect.push("left_shoulder", "left_hip");
          feedback = "Don't lean forward - stay upright";
        }
      }

      // Check hip alignment (should stay level)
      if (leftHip && rightHip && leftHip.visibility > 0.4 && rightHip.visibility > 0.4) {
        const hipTilt = Math.abs(leftHip.y - rightHip.y);
        if (hipTilt > 30) {
          incorrect.push("left_hip", "right_hip");
          feedback = "Keep hips level";
        }
      }
    }

    // PLANK - Angular perfection checks
    if (exerciseLower.includes("plank")) {
      // Check body alignment (shoulder-hip-ankle should be perfectly straight)
      if (leftShoulder && leftHip && leftAnkle && 
          leftShoulder.visibility > 0.4 && leftHip.visibility > 0.4 && leftAnkle.visibility > 0.4) {
        const bodyAngle = getAngle(leftShoulder, leftHip, leftAnkle);
        
        if (bodyAngle < 165) {
          incorrect.push("left_hip", "left_shoulder", "left_ankle");
          feedback = "Hips sagging - raise them up";
        } else if (bodyAngle > 195) {
          incorrect.push("left_hip");
          feedback = "Hips too high - lower them down";
        }
      }

      // Check elbow angle (should be 90° for forearm plank)
      if (leftShoulder && leftElbow && leftWrist &&
          leftShoulder.visibility > 0.4 && leftElbow.visibility > 0.4 && leftWrist.visibility > 0.4) {
        const elbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        
        if (elbowAngle < 70 || elbowAngle > 110) {
          incorrect.push("left_elbow", "left_wrist");
          feedback = "Keep forearms perpendicular";
        }
      }

      // Check shoulder position (should be directly above elbows)
      if (leftShoulder && leftElbow && leftShoulder.visibility > 0.4 && leftElbow.visibility > 0.4) {
        const shoulderElbowDist = Math.abs(leftShoulder.x - leftElbow.x);
        if (shoulderElbowDist > 50) {
          incorrect.push("left_shoulder", "left_elbow");
          feedback = "Shoulders over elbows";
        }
      }

      // Check neck alignment
      if (leftShoulder && L("nose") && leftShoulder.visibility > 0.4 && L("nose")?.visibility > 0.4) {
        const neck = L("nose");
        if (neck && neck.y < leftShoulder.y - 50) {
          incorrect.push("left_shoulder");
          feedback = "Look down - neutral neck";
        }
      }
    }

    // JUMPING JACKS - Angular perfection checks
    if (exerciseLower.includes("jack") || exerciseLower.includes("jump")) {
      // Check arm angle at top position
      if (leftShoulder && leftElbow && leftWrist &&
          leftShoulder.visibility > 0.4 && leftElbow.visibility > 0.4 && leftWrist.visibility > 0.4) {
        const armAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        
        // Arms should be nearly straight when raised
        if (leftWrist.y < leftShoulder.y && armAngle < 150) {
          incorrect.push("left_elbow", "left_wrist");
          feedback = "Straighten arms overhead";
        }
      }

      // Check leg spread angle
      if (leftHip && leftKnee && leftAnkle &&
          leftHip.visibility > 0.4 && leftKnee.visibility > 0.4 && leftAnkle.visibility > 0.4) {
        const legAngle = getAngle(leftHip, leftKnee, leftAnkle);
        
        // Legs should stay relatively straight
        if (legAngle < 160) {
          incorrect.push("left_knee");
          feedback = "Keep legs straight during jump";
        }
      }

      // Check landing stability
      if (leftAnkle && rightAnkle && leftAnkle.visibility > 0.4 && rightAnkle.visibility > 0.4) {
        const ankleLevelDiff = Math.abs(leftAnkle.y - rightAnkle.y);
        if (ankleLevelDiff > 40) {
          incorrect.push("left_ankle", "right_ankle");
          feedback = "Land with both feet together";
        }
      }
    }

    setIncorrectJoints(incorrect);
    setFormFeedback(feedback);
  };

  // draw keypoints with MAXIMUM visibility - THICK AF
  const drawKeypoints = (ctx: CanvasRenderingContext2D, keypoints: any[]) => {
    keypoints.forEach((keypoint) => {
      if (keypoint.visibility && keypoint.visibility > 0.4) {
        const isIncorrect = incorrectJoints.includes(keypoint.name);
        
        // Draw massive glow effect
        ctx.shadowBlur = 40;
        ctx.shadowColor = isIncorrect ? "#ef4444" : "#00ff00";
        
        // Draw outer glow circle (huge)
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = isIncorrect ? "rgba(239, 68, 68, 0.6)" : "rgba(0, 255, 0, 0.6)";
        ctx.fill();
        
        // Draw middle circle
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 14, 0, 2 * Math.PI);
        ctx.fillStyle = isIncorrect ? "rgba(239, 68, 68, 0.8)" : "rgba(0, 255, 0, 0.8)";
        ctx.fill();
        
        // Draw inner circle (main dot) - THICK
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = isIncorrect ? "#ef4444" : "#00ff00";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
      }
    });
  };

  // draw skeleton connections with MAXIMUM visibility - THICK AF
  const drawSkeleton = (ctx: CanvasRenderingContext2D, keypoints: any[]) => {
    const connections: [string,string][] = [
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

      if (startKp?.visibility && endKp?.visibility && startKp.visibility > 0.4 && endKp.visibility > 0.4) {
        const isIncorrect = incorrectJoints.includes(start) || incorrectJoints.includes(end);
        
        // Draw MASSIVE glow effect for lines
        ctx.shadowBlur = 30;
        ctx.shadowColor = isIncorrect ? "#ef4444" : "#00ff00";
        
        // Draw outermost glow layer - SUPER THICK
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = isIncorrect ? "rgba(239, 68, 68, 0.4)" : "rgba(0, 255, 0, 0.4)";
        ctx.lineWidth = isIncorrect ? 35 : 30;
        ctx.stroke();
        
        // Draw middle glow layer
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = isIncorrect ? "rgba(239, 68, 68, 0.6)" : "rgba(0, 255, 0, 0.6)";
        ctx.lineWidth = isIncorrect ? 25 : 20;
        ctx.stroke();
        
        // Draw main line - THICK AF
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = isIncorrect ? "#ef4444" : "#00ff00";
        ctx.lineWidth = isIncorrect ? 18 : 15;
        ctx.stroke();
        
        // Draw core line with white border for extra visibility
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = isIncorrect ? "#ff6b6b" : "#00ff00";
        ctx.lineWidth = isIncorrect ? 12 : 10;
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
      }
    });
  };

  const saveWorkoutHistory = () => {
    const workoutData = {
      exerciseName: exercise.name,
      reps: currentReps,
      targetReps: parseInt(targetReps || "0"),
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
    // stop camera tracks if any
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    if (poseRef.current) {
      try { poseRef.current.close(); } catch {}
    }
    // stop camera util if used
    try {
      if (cameraUtilRef.current && typeof cameraUtilRef.current.stop === "function") {
        cameraUtilRef.current.stop();
      }
    } catch (e) {
      // ignore
    }

    setStep("reps");
    setCurrentReps(0);
    setTargetReps("");
    setFormFeedback("");
    setIncorrectJoints([]);
    onClose();
  };

  // UI render
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
                    style={{ width: `${(currentReps / (parseInt(targetReps || "1"))) * 100}%` }}
                  />
                </div>

                {isModelLoading && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <Camera className="w-12 h-12 mx-auto text-white animate-pulse" />
                      <p className="text-white text-sm">Loading motion sensing...</p>
                      {initError && <p className="text-sm text-red-300 mt-2">{initError}</p>}
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
                    <Progress value={(currentReps / (parseInt(targetReps || "1"))) * 100} />
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
