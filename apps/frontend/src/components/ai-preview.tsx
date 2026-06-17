import { useEffect, useRef } from "react";

interface AiPreviewProps {
  videoUrl: string;
  mode: "one" | "multiple";
  onReady?: () => void;
}

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/face_detector.task";
const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";

export function AiPreview({ videoUrl, mode, onReady }: AiPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let faceDetector: any = null;
    let animId = 0;

    async function init() {
      const { FaceDetector, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );

      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      onReady?.();

      await video.play();

      const ctx = canvas.getContext("2d")!;
      let lastTimestamp = -1;

      function draw() {
        if (!video || !canvas) return;
        const now = performance.now();

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        if (faceDetector && video.readyState >= 2) {
          const timestamp = video.currentTime * 1000;
          if (timestamp !== lastTimestamp) {
            lastTimestamp = timestamp;
            const result = faceDetector.detectForVideo(video, now);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (result.detections) {
              for (const det of result.detections) {
                const box = det.boundingBox;
                ctx.strokeStyle = "#00ff88";
                ctx.lineWidth = 3;
                ctx.strokeRect(box.originX, box.originY, box.width, box.height);

                ctx.fillStyle = "#00ff88";
                ctx.font = "14px monospace";
                const score = (det.categories[0]?.score ?? 0).toFixed(2);
                ctx.fillText(
                  `${(parseFloat(score) * 100).toFixed(0)}%`,
                  box.originX + 4,
                  box.originY - 6,
                );

                if (det.keypoints) {
                  ctx.fillStyle = "#ff3366";
                  for (const kp of det.keypoints) {
                    ctx.beginPath();
                    ctx.arc(kp.x, kp.y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                  }
                }
              }
            }
          }
        }

        animId = requestAnimationFrame(draw);
      }

      draw();
    }

    init().catch(console.error);

    return () => {
      cancelAnimationFrame(animId);
      if (faceDetector) {
        faceDetector.close();
      }
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.src = "";
        video.load();
      }
    };
  }, [videoUrl, mode]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto overflow-hidden rounded-xl border border-border bg-black"
      style={{ aspectRatio: "16 / 9", maxWidth: "720px" }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="h-full w-full"
        controls
        playsInline
        crossOrigin="anonymous"
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
