import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const tz = "Asia/Karachi";

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export function fmtTime(iso: string | number | Date, seconds = true) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", second: seconds ? "2-digit" : undefined,
  }).format(new Date(iso));
}

/** mm:ss or h:mm:ss for a millisecond duration (never negative). */
export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** "in 2 h 5 min" / "3 min ago" style relative description in minutes. */
export function fmtRelative(ms: number) {
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60000);
  const label = min < 1 ? "less than a minute" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
  return ms >= 0 ? `in ${label}` : `${label} ago`;
}

export function uuid() {
  return crypto.randomUUID();
}
