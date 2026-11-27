import { beforeAll, describe, expect, it } from "vitest";
import { settings } from "@/lib/contracts/core";
import { activationKeyFor, displayKey, drawPaper, hashKey, normalizeKey, paperSeed, type PaperQuestion } from "../paper";

beforeAll(() => { process.env.AUTH_SECRET ??= "unit-test-secret-for-paper-seeding-only"; });

const pool: PaperQuestion[] = Array.from({ length: 12 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, type: "single", topic: i < 6 ? "Algebra" : "Logic",
  difficulty: 1, marks: 1, text: `Question ${i}`,
  options: ["a", "b", "c", "d"].map((id) => ({ id, text: id.toUpperCase(), isCorrect: id === "a" })),
}));
const config = settings.parse({ blueprint: [{ topic: "Algebra", difficulty: 1, count: 3 }, { topic: "Logic", difficulty: 1, count: 3 }] });
const order = (key: string) => drawPaper(pool, config, { seed: paperSeed(key) }).map(({ questionId, options }) => questionId + ":" + options.map(({ id }) => id).join(""));

describe("activation-key seeded papers", () => {
  it("the same key always reproduces the same paper, including option order", () => {
    expect(order("A1B2C3D4E5F60718")).toEqual(order("a1b2-c3d4-e5f6-0718"));
  });

  it("different candidates' keys give different papers drawn by the same blueprint", () => {
    const papers = new Set(Array.from({ length: 8 }, (_, i) => order(activationKeyFor(`key-row-${i}`)).join("|")));
    expect(papers.size).toBeGreaterThan(1);
    for (const key of ["K1", "K2", "K3"]) {
      const drawn = drawPaper(pool, config, { seed: paperSeed(key) });
      expect(drawn.filter(({ questionId }) => pool.find((q) => q.id === questionId)!.topic === "Algebra")).toHaveLength(3);
      expect(drawn).toHaveLength(6);
    }
  });

  it("derives re-displayable keys whose hash matches what is stored", () => {
    const key = activationKeyFor("row-1");
    expect(key).toMatch(/^[0-9A-F]{16}$/);
    expect(displayKey(key)).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(hashKey(displayKey(key).toLowerCase())).toBe(hashKey(key));
    expect(normalizeKey(" ab-cd ")).toBe("ABCD");
    expect(activationKeyFor("row-2")).not.toBe(key);
  });
});
