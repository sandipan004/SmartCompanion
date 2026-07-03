"use client";

import { useEffect, useRef } from "react";

export default function Camera({ onCapture }: { onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function startCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }

    startCamera();
  }, []);

  function captureImage() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 224;
    canvas.height = 224;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
      onCapture(file);
    }, "image/jpeg");
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="rounded-xl w-full max-w-md"
      />

      <button
        onClick={captureImage}
        className="bg-blue-500 text-white px-6 py-3 rounded-lg"
      >
        📸 Capture
      </button>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}