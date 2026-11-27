/**
 * Explainable integrity engine (PRD §8). Pure and deterministic: incidents are recomputed
 * from stored observations on every read, so the same events always give the same incidents
 * and the same keys (reviews are stored separately, keyed by incident key).
 *
 * Observations are hints, never proof. Nothing here changes scores, status or time.
 */
import type { IncidentCategory, IncidentDTO, IncidentReview, IncidentSeverity, Observation } from "@/contracts";

export interface StoredObservation extends Observation {
  clientSeq: number;
}

export const AWAY_MIN_SEC = 5; // hidden / fullscreen exit at or above this → Review
export const BLUR_ONLY_REVIEW_SEC = 30; // focus loss alone only becomes Review when long
export const PASTE_LINK_WINDOW_SEC = 10; // paste within this many seconds after returning is related
export const PASTE_LINK_MIN_CHARS = 50;
export const PASTE_ALONE_REVIEW_CHARS = 200;
export const REPEAT_COUNT = 3; // this many Review incidents…
export const REPEAT_WINDOW_MIN = 10; // …within this window → Priority

type AwaySignal = "hidden" | "blur" | "fullscreen";
const OPENERS: Record<string, AwaySignal> = { visibility_hidden: "hidden", window_blur: "blur", fullscreen_exit: "fullscreen" };
const CLOSERS: Record<string, AwaySignal> = { visibility_visible: "hidden", window_focus: "blur", fullscreen_enter: "fullscreen" };

const t = (iso: string) => Date.parse(iso);
const secs = (a: string, b: string) => Math.max(0, Math.round((t(b) - t(a)) / 1000));

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const hms = (iso: string) => clock.format(new Date(iso));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

interface Draft {
  category: IncidentCategory;
  severity: IncidentSeverity;
  startedAt: string;
  endedAt: string | null;
  questionPosition?: number;
  explanation: string;
  groupingReason: string;
  observations: StoredObservation[];
}

interface AwayState {
  obs: StoredObservation[];
  open: Set<AwaySignal>;
  seen: Set<AwaySignal>;
  start: string;
}

function awayDraft(a: AwayState, end: string | null): Draft & { paste?: StoredObservation } {
  const dur = end ? secs(a.start, end) : null;
  const strong = a.seen.has("hidden") || a.seen.has("fullscreen");
  let severity: IncidentSeverity = "info";
  if (end === null) severity = "review";
  else if (strong && dur! >= AWAY_MIN_SEC) severity = "review";
  else if (!strong && dur! >= BLUR_ONLY_REVIEW_SEC) severity = "review";

  const what = a.seen.has("hidden")
    ? "The exam page was hidden"
    : a.seen.has("fullscreen")
      ? "The candidate left fullscreen"
      : "The exam window lost focus (the page stayed visible)";
  const when = end ? `for ${plural(dur!, "second")} (${hms(a.start)}–${hms(end)})` : `at ${hms(a.start)} and no return was observed (end unknown)`;
  const unknown = a.seen.has("hidden") ? " What happened while the page was hidden is unknown." : "";
  const parts: string[] = [];
  if (a.seen.has("hidden")) parts.push("page hidden");
  if (a.seen.has("blur")) parts.push("window focus loss");
  if (a.seen.has("fullscreen")) parts.push("fullscreen exit");
  return {
    category: "away",
    severity,
    startedAt: a.start,
    endedAt: end,
    explanation: `${what} ${when}.${unknown}`,
    groupingReason:
      parts.length > 1
        ? `${plural(a.obs.length, "observation")} merged: ${parts.join(", ")} overlapped and were counted as one absence.`
        : `${plural(a.obs.length, "observation")}: ${parts[0]} and the matching return.`,
    observations: [...a.obs],
  };
}

export function groupIncidents(
  attemptId: string,
  events: StoredObservation[],
  reviews: Record<string, IncidentReview> = {},
): IncidentDTO[] {
  // observed order: client time (late arrivals keep their place), then per-tab sequence
  const sorted = [...events].sort((x, y) => t(x.clientTime) - t(y.clientTime) || x.clientSeq - y.clientSeq);
  const drafts: (Draft & { paste?: StoredObservation })[] = [];
  let away: AwayState | null = null;
  let lastAway: (Draft & { paste?: StoredObservation }) | null = null;
  let offline: StoredObservation | null = null;

  for (const e of sorted) {
    const opener = OPENERS[e.type];
    const closer = CLOSERS[e.type];

    if (opener) {
      if (!away) away = { obs: [e], open: new Set([opener]), seen: new Set([opener]), start: e.clientTime };
      else { away.obs.push(e); away.open.add(opener); away.seen.add(opener); }
      continue;
    }
    if (closer) {
      if (away && away.open.has(closer)) {
        away.obs.push(e);
        away.open.delete(closer);
        if (away.open.size === 0) {
          lastAway = awayDraft(away, e.clientTime);
          drafts.push(lastAway);
          away = null;
        }
      }
      continue;
    }

    switch (e.type) {
      case "paste": {
        const chars = Number(e.detail?.chars ?? 0);
        const outcome = String(e.detail?.outcome ?? "allowed");
        const pos = e.detail?.position !== undefined ? Number(e.detail.position) : undefined;
        const gap = lastAway?.endedAt ? (t(e.clientTime) - t(lastAway.endedAt)) / 1000 : Infinity;
        if (lastAway && !lastAway.paste && chars >= PASTE_LINK_MIN_CHARS && gap >= 0 && gap <= PASTE_LINK_WINDOW_SEC) {
          // related paste: absence followed by pasting → Priority if the absence was meaningful
          lastAway.paste = e;
          lastAway.observations.push(e);
          lastAway.category = "away";
          lastAway.questionPosition = pos;
          const awaySec = secs(lastAway.startedAt, lastAway.endedAt!);
          if (lastAway.severity === "review" || awaySec >= AWAY_MIN_SEC) lastAway.severity = "priority";
          lastAway.explanation += ` ${gap < 1 ? "Immediately" : `${plural(Math.round(gap), "second")}`} after returning${pos ? ` to Question ${pos}` : ""}, a ${chars}-character paste was ${outcome === "blocked" ? "attempted and blocked by the exam policy" : "made"}.`;
          lastAway.groupingReason += ` A paste within ${PASTE_LINK_WINDOW_SEC} s of returning was attached to this absence.`;
        } else if (chars >= PASTE_LINK_MIN_CHARS) {
          drafts.push({
            category: "paste",
            severity: chars >= PASTE_ALONE_REVIEW_CHARS ? "review" : "info",
            startedAt: e.clientTime,
            endedAt: e.clientTime,
            questionPosition: pos,
            explanation: `A ${chars}-character paste was ${outcome === "blocked" ? "attempted and blocked by the exam policy" : "made"}${pos ? ` on Question ${pos}` : ""}. No absence from the exam page was observed around it.`,
            groupingReason: "Single paste observation, not linked to an absence.",
            observations: [e],
          });
        }
        break;
      }
      case "copy_blocked": {
        const prev = drafts.at(-1);
        if (prev && prev.category === "paste" && prev.groupingReason.startsWith("Copy") && t(e.clientTime) - t(prev.startedAt) < 60_000) {
          prev.observations.push(e);
          prev.endedAt = e.clientTime;
          prev.explanation = `${plural(prev.observations.length, "attempt")} to copy question text were blocked by the exam policy.`;
        } else {
          drafts.push({
            category: "paste", severity: "info", startedAt: e.clientTime, endedAt: e.clientTime,
            explanation: "An attempt to copy question text was blocked by the exam policy.",
            groupingReason: "Copy attempts within 60 s are grouped together.",
            observations: [e],
          });
        }
        break;
      }
      case "offline":
        if (!offline) offline = e;
        break;
      case "online":
        if (offline) {
          const d = secs(offline.clientTime, e.clientTime);
          drafts.push({
            category: "connectivity", severity: "info", startedAt: offline.clientTime, endedAt: e.clientTime,
            explanation: `The browser reported no internet connection for ${plural(d, "second")} (${hms(offline.clientTime)}–${hms(e.clientTime)}). Answers made meanwhile were kept on the device and sent on reconnection.`,
            groupingReason: "Connection loss and recovery are tracked separately from absences and never raise severity.",
            observations: [offline, e],
          });
          offline = null;
        }
        break;
      case "heartbeat_gap": {
        const s = Number(e.detail?.seconds ?? 0);
        drafts.push({
          category: "connectivity", severity: "info", startedAt: e.clientTime, endedAt: null,
          explanation: `The server heard nothing from this attempt for ${plural(s, "second")}. A missed heartbeat doesn't show why contact stopped.`,
          groupingReason: "Derived by the server from missing heartbeats.",
          observations: [e],
        });
        break;
      }
      case "session_opened":
      case "session_superseded":
        drafts.push({
          category: "session", severity: "info", startedAt: e.clientTime, endedAt: e.clientTime,
          explanation: e.type === "session_opened"
            ? `The exam was opened in another tab or device (open ${e.detail?.open ?? "?"} of ${e.detail?.max ?? "?"}).`
            : "An earlier window was replaced by a newer one and could no longer save.",
          groupingReason: "Recorded by the server when a tab or device opens the attempt.",
          observations: [e],
        });
        break;
      case "mobile_detected":
        drafts.push({
          category: "session", severity: "info", startedAt: e.clientTime, endedAt: e.clientTime,
          explanation: "The exam was opened on what looks like a phone or tablet.", groupingReason: "Single observation.", observations: [e],
        });
        break;
      case "face_absent_10s":
      case "multiple_faces":
        drafts.push({
          category: "camera", severity: "review", startedAt: e.clientTime, endedAt: e.clientTime,
          explanation: e.type === "face_absent_10s"
            ? "The on-device camera check saw no face for at least 10 seconds. No image was recorded."
            : "The on-device camera check counted more than one face. No image was recorded.",
          groupingReason: "Counted on the candidate's device; only the count is sent.", observations: [e],
        });
        break;
      default:
        break; // resize and unknown types are context only
    }
  }

  if (away) drafts.push(awayDraft(away, null));
  if (offline) {
    drafts.push({
      category: "connectivity", severity: "info", startedAt: offline.clientTime, endedAt: null,
      explanation: `The browser reported no internet connection from ${hms(offline.clientTime)}; no reconnection was observed.`,
      groupingReason: "Connection loss without a matching recovery.", observations: [offline],
    });
  }

  // repeated absences: the Nth Review within the window becomes Priority
  const reviewTimes: number[] = [];
  for (const d of drafts) {
    if (d.severity !== "review" || (d.category !== "away" && d.category !== "paste")) continue;
    const now = t(d.startedAt);
    while (reviewTimes.length && now - reviewTimes[0] > REPEAT_WINDOW_MIN * 60_000) reviewTimes.shift();
    reviewTimes.push(now);
    if (reviewTimes.length >= REPEAT_COUNT) {
      d.severity = "priority";
      d.groupingReason += ` Raised to Priority: ${plural(reviewTimes.length, "Review-level incident")} within ${REPEAT_WINDOW_MIN} minutes.`;
    }
  }

  return drafts
    .sort((a, b) => t(a.startedAt) - t(b.startedAt))
    .map((d) => {
      const key = `${attemptId}:${d.observations[0].id}`;
      return {
        key, attemptId, category: d.category, severity: d.severity, startedAt: d.startedAt, endedAt: d.endedAt,
        durationSec: d.endedAt ? secs(d.startedAt, d.endedAt) : null, questionPosition: d.questionPosition,
        explanation: d.explanation, groupingReason: d.groupingReason,
        observations: d.observations.map((o) => ({ id: o.id, type: o.type, clientTime: o.clientTime, serverTime: o.serverTime, detail: o.detail })),
        review: reviews[key] ?? null,
      };
    });
}

export function countBySeverity(incidents: IncidentDTO[]) {
  const c = { info: 0, review: 0, priority: 0 };
  incidents.forEach((i) => c[i.severity]++);
  return c;
}
