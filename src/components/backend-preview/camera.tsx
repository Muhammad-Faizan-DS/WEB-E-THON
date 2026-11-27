"use client";

import { useRef, useState } from "react";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { message } from "./client";

type CameraSignal = "camera_no_face" | "camera_multiple_faces" | "camera_out_of_frame" | "camera_return";
type CameraSession = { stream: MediaStream; detector: FaceDetector };
let camera: CameraSession | undefined;
let using: Promise<CameraSession> | undefined;

async function openCamera() {
  if (camera?.stream.getVideoTracks().some((track) => track.readyState === "live")) return camera;
  if (using) return using;
  using = (async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires a supported browser over HTTPS or localhost.");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
    try {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const wasm = await FilesetResolver.forVisionTasks("/models/vision");
      const detector = await FaceDetector.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: "/models/vision/blaze_face_short_range.tflite" }, runningMode: "VIDEO", minDetectionConfidence: 0.5,
      });
      camera = { stream, detector };
      return camera;
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Camera detection could not start. Try again or request an exception from your examiner.");
    }
  })();
  try { return await using; } finally { using = undefined; }
}

export function stopCamera() {
  if (!camera) return;
  camera.stream.getTracks().forEach((track) => track.stop());
  camera.detector.close();
  camera = undefined;
}

async function prepareVideo(video: HTMLVideoElement) {
  const active = await openCamera();
  video.srcObject = active.stream;
  await video.play();
  if (video.readyState < 2) await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("The camera did not provide an image.")), 5_000);
    video.addEventListener("loadeddata", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
  });
  return active;
}

function detect(video: HTMLVideoElement, detector: FaceDetector): CameraSignal | null {
  const { detections } = detector.detectForVideo(video, performance.now());
  if (detections.length > 1) return "camera_multiple_faces";
  const box = detections[0]?.boundingBox;
  if (!box) return "camera_no_face";
  return box.originX < 2 || box.originY < 2 || box.originX + box.width > video.videoWidth - 2 ||
    box.originY + box.height > video.videoHeight - 2 ? "camera_out_of_frame" : null;
}

export function CameraGate({ onReady }: { onReady: (ready: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState({ busy: false, text: "" });
  async function check() {
    if (!video.current) return;
    onReady(false);
    setState({ busy: true, text: "" });
    try {
      const active = await prepareVideo(video.current);
      const status = detect(video.current, active.detector);
      onReady(!status);
      setState({ busy: false, text: status ? "Position one face fully within the camera frame and check again." : "Camera check passed." });
    } catch (error) {
      setState({ busy: false, text: message(error) });
      stopCamera();
    }
  }
  return <section className="panel"><h2>Camera check</h2>
    <p>Face detection runs on this device. Integrity warnings may capture three still frames for examiner review. Audio is disabled.</p>
    <video ref={video} muted playsInline width={240} height={180} aria-label="Your camera preview" />
    <div><button disabled={state.busy} onClick={() => void check()}>{state.busy ? "Checking camera…" : "Consent and check camera"}</button></div>
    <p aria-live="polite">{state.text}</p>
  </section>;
}

export async function monitorCamera(video: HTMLVideoElement, warning: (signal: CameraSignal, frames: string[]) => void) {
  const active = await prepareVideo(video);
  let missingSince = 0;
  let last = -Infinity;
  let recording = false;
  let cancelled = false;
  let absent = false;
  const timer = setInterval(async () => {
    if (recording || cancelled || video.readyState < 2) return;
    const signal = detect(video, active.detector);
    const now = performance.now();
    if (signal === "camera_no_face") missingSince ||= now;
    else missingSince = 0;
    // Tell the server the face is back so the 10-minute absence clock stops.
    if (absent && signal !== "camera_no_face") { absent = false; warning("camera_return", []); }
    if (!signal || now - last < 20_000 || (signal === "camera_no_face" && now - missingSince < 5_000)) return;
    recording = true;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 240;
      const context = canvas.getContext("2d");
      if (!context) return;
      const frames: string[] = [];
      for (let i = 0; i < 3 && !cancelled; i++) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.5));
        if (i < 2) await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!cancelled) warning(signal, frames);
      if (signal === "camera_no_face") absent = true;
      last = now;
    } finally { recording = false; }
  }, 1_500);
  return () => { cancelled = true; clearInterval(timer); stopCamera(); };
}
