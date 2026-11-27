"use client";
/**
 * clientSessionId identifies one browser tab for the open limit (BR-12).
 * sessionStorage survives a refresh in the same tab, so a refresh is never counted as a new open.
 */
export function examSessionKey(examId: string) { return `exam:session:exam:${examId}`; }
export function attemptSessionKey(attemptId: string) { return `exam:session:${attemptId}`; }

export function getOrCreateSession(key: string) {
  let v = sessionStorage.getItem(key);
  if (!v) { v = crypto.randomUUID(); sessionStorage.setItem(key, v); }
  return v;
}


export async function enterFullscreen() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}
