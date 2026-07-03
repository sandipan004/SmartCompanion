"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

export interface VideoStreamHandle {
  captureImage: () => Promise<File | null>;
}

interface VideoStreamProps {
  sessionId: string;
  onDistracted: () => void;
}

const VideoStream = forwardRef<VideoStreamHandle, VideoStreamProps>(({ sessionId, onDistracted }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    captureImage: () => {
      return new Promise((resolve) => {
        if (!videoRef.current) return resolve(null);
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], "snapshot.jpg", { type: "image/jpeg" });
              resolve(file);
            } else {
              resolve(null);
            }
          }, "image/jpeg", 0.8);
        } else {
          resolve(null);
        }
      });
    }
  }));

  useEffect(() => {
    let stream: MediaStream | null = null;
    let interval: NodeJS.Timeout;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const ws = new WebSocket(`ws://localhost:8000/session/${sessionId}/stream`);
        wsRef.current = ws;

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data);
          if (data.trigger === "distracted") {
            onDistracted();
          }
          if (data.tracking) {
             drawOverlay(data.tracking);
          }
        };

        interval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN && videoRef.current) {
             const hiddenCanvas = document.createElement("canvas");
             hiddenCanvas.width = videoRef.current.videoWidth;
             hiddenCanvas.height = videoRef.current.videoHeight;
             const ctx = hiddenCanvas.getContext("2d");
             if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0);
                hiddenCanvas.toBlob((blob) => {
                  if (blob) ws.send(blob);
                }, "image/jpeg", 0.5);
             }
          }
        }, 100);

      } catch (err: any) {
        setError(err.message);
      }
    }

    startCamera();

    return () => {
      clearInterval(interval);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (wsRef.current) wsRef.current.close();
    };
  }, [sessionId]);

  const drawOverlay = (tracking: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "cyan";
    for (const hand of tracking.hands || []) {
      for (const lm of hand) {
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    
    ctx.fillStyle = "magenta";
    for (const face of tracking.faces || []) {
      for (const lm of face) {
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 1, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 2;
    ctx.font = "16px Arial";
    ctx.fillStyle = "yellow";
    for (const obj of tracking.objects || []) {
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      ctx.fillText(obj.name, obj.x, obj.y - 5);
    }
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
      {error && <div className="absolute inset-0 flex items-center justify-center text-rose-500 bg-black/80 z-20 p-4 text-center">{error}</div>}
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
      
      <div className="absolute top-4 left-4 z-20 flex gap-2">
         <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mt-1"></span>
         <span className="text-xs font-mono text-emerald-500 tracking-widest uppercase">Live Tracking Active</span>
      </div>
    </div>
  );
});

export default VideoStream;
