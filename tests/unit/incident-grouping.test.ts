import { describe, expect, it } from "vitest";
import { groupIncidents, type StoredObservation } from "@/server/incidents/group";

const base = Date.parse("2026-11-27T05:24:00Z"); // 10:24:00 PKT
let seq = 0;
const ev = (sec: number, type: StoredObservation["type"], detail?: Record<string, unknown>, delaySec = 0): StoredObservation => ({
  id: `e${seq}`,
  clientSeq: seq++,
  type,
  clientTime: new Date(base + sec * 1000).toISOString(),
  serverTime: new Date(base + (sec + delaySec) * 1000).toISOString(),
  detail,
});

describe("groupIncidents (PRD §8)", () => {
  it("T28: 45 s away then a blocked paste on Q3 → one Priority incident", () => {
    seq = 0;
    const events = [
      ev(2, "visibility_hidden"), ev(2.3, "window_blur"),
      ev(47, "visibility_visible"), ev(47.1, "window_focus"),
      ev(49, "paste", { chars: 348, outcome: "blocked", position: 3 }),
    ];
    const out = groupIncidents("a1", events);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("priority");
    expect(out[0].category).toBe("away");
    expect(out[0].durationSec).toBe(45);
    expect(out[0].questionPosition).toBe(3);
    expect(out[0].observations).toHaveLength(5);
    expect(out[0].explanation).toContain("348-character paste");
    expect(out[0].explanation).toContain("unknown");
    expect(out[0].key).toBe("a1:e0");
  });

  it("T29: Wi-Fi off for 30 s with the tab visible → connectivity Info only", () => {
    seq = 0;
    const out = groupIncidents("a1", [ev(0, "offline"), ev(30, "online")]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ category: "connectivity", severity: "info", durationSec: 30 });
  });

  it("brief focus loss is Info; long focus loss alone is Review, never Priority", () => {
    seq = 0;
    const out = groupIncidents("a1", [ev(0, "window_blur"), ev(2, "window_focus"), ev(100, "window_blur"), ev(140, "window_focus")]);
    expect(out.map((i) => i.severity)).toEqual(["info", "review"]);
  });

  it("absence without a return is Review with end unknown", () => {
    seq = 0;
    const out = groupIncidents("a1", [ev(0, "visibility_hidden")]);
    expect(out[0]).toMatchObject({ severity: "review", endedAt: null, durationSec: null });
  });

  it("three Review absences within 10 minutes → the third becomes Priority", () => {
    seq = 0;
    const evs = [0, 120, 240].flatMap((s) => [ev(s, "visibility_hidden"), ev(s + 10, "visibility_visible")]);
    const out = groupIncidents("a1", evs);
    expect(out.map((i) => i.severity)).toEqual(["review", "review", "priority"]);
    expect(out[2].groupingReason).toContain("Raised to Priority");
  });

  it("pastes: large alone → Review, small → ignored, paste long after return → not linked", () => {
    seq = 0;
    const out = groupIncidents("a1", [
      ev(0, "paste", { chars: 20, outcome: "allowed" }),
      ev(10, "paste", { chars: 300, outcome: "allowed", position: 2 }),
      ev(20, "visibility_hidden"), ev(30, "visibility_visible"),
      ev(60, "paste", { chars: 120, outcome: "allowed" }),
    ]);
    expect(out.map((i) => `${i.category}:${i.severity}`)).toEqual(["paste:review", "away:review", "paste:info"]);
  });

  it("late-arriving events keep their observed order and reviews attach by key", () => {
    seq = 0;
    const events = [ev(0, "visibility_hidden", undefined, 40), ev(8, "visibility_visible", undefined, 40)];
    const out = groupIncidents("a1", events, { "a1:e0": { decision: "dismissed", note: "Bathroom break, agreed", reviewer: "Dr. Rauf", reviewedAt: new Date(base).toISOString() } });
    expect(out[0].review?.decision).toBe("dismissed");
    expect(out[0].durationSec).toBe(8);
  });
});
