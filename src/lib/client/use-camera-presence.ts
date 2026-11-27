"use client";
/**
 * Optional camera presence check (PRD §8): runs only on this device. Frames are read in memory and
 * dropped; no image is stored or sent. Where the browser has a built-in face detector it checks that a
 * face is visible; otherwise it checks the camera stays on and uncovered. After 20 s without that, the
 * state becomes "absent" (the workspace hides questions and notes an observation). Never ends an attempt.
 */
import * as React from "react";

export type CameraState = "off" | "starting" | "ok" | "absent" | "denied";
type Detector = { detect: (v: HTMLVideoElement) => Promise<unknown[]> };

export function useCameraPresence(enabled: boolean, onAbsent: () => void, onDenied: () => void) {
  const [state, setState] = React.useState<CameraState>("off");
  const absentRef = React.useRef(onAbsent);
  const deniedRef = React.useRef(onDenied);
  React.useEffect(() => { absentRef.current = onAbsent; deniedRef.current = onDenied; }, [onAbsent, onDenied]);

  React.useEffect(() => {
    if (!enabled) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    let absentSince: number | null = null;
    let flagged = false;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const FD = (window as unknown as { FaceDetector?: new (o: object) => Detector }).FaceDetector;
    const detector = FD ? new FD({ fastMode: true, maxDetectedFaces: 2 }) : null;

    const start = async () => {
      setState("starting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      } catch {
        if (!cancelled) { setState("denied"); deniedRef.current(); }
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      timer = setInterval(async () => {
        const track = stream?.getVideoTracks()[0];
        let present = !!track && track.readyState === "live" && !track.muted;
        if (present && detector) {
          try { present = (await detector.detect(video)).length > 0; } catch { /* keep the on/uncovered result */ }
        } else if (present && ctx) {
          ctx.drawImage(video, 0, 0, 64, 48);
          const d = ctx.getImageData(0, 0, 64, 48).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
          present = sum / (d.length / 4) / 3 > 18; // a covered lens reads near-black
        }
        if (present) { absentSince = null; flagged = false; setState("ok"); return; }
        absentSince ??= Date.now();
        if (Date.now() - absentSince >= 20000) {
          setState("absent");
          if (!flagged) { flagged = true; absentRef.current(); }
        }
      }, 1000);
    };
    const t = setTimeout(() => void start(), 0);
    return () => { cancelled = true; clearTimeout(t); if (timer) clearInterval(timer); stream?.getTracks().forEach((tr) => tr.stop()); };
  }, [enabled]);

  return enabled ? state : "off";
}
