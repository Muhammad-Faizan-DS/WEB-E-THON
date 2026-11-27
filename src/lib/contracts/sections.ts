import { z } from "zod";
import { blueprintCell, course, id, marks, questionType, tags, type ExamSettings, type ExamType } from "./core";
import { questionImport } from "./operations";

/** PRD §24.3 presets. Applied by the wizard on the client; every value stays editable on the exam afterwards. */
export interface ExamPreset {
  type: ExamType;
  label: string;
  description: string;
  durationMin: number;
  settings: Pick<ExamSettings, "integrityMode" | "openLimit" | "cameraCheck" | "sequentialReveal">;
  /** "optional" = camera starts off but the type suggests offering it. */
  camera: "off" | "optional" | "on";
  /** "instant" = results intended to appear right after submit. Today results still use the examiner publish step (BR-12). */
  resultsRelease: "instant" | "manual";
}

export const examPresets: readonly ExamPreset[] = [
  { type: "practice", label: "Practice", description: "Low-stakes self-check. Signals are logged only.", durationMin: 20,
    settings: { integrityMode: "standard", openLimit: null, cameraCheck: false, sequentialReveal: false }, camera: "off", resultsRelease: "instant" },
  { type: "quiz", label: "Quiz", description: "Short graded check with review-mode integrity prompts.", durationMin: 30,
    settings: { integrityMode: "review", openLimit: 10, cameraCheck: false, sequentialReveal: false }, camera: "off", resultsRelease: "manual" },
  { type: "assignment", label: "Assignment", description: "Longer open-ended work with written answers.", durationMin: 120,
    settings: { integrityMode: "review", openLimit: null, cameraCheck: false, sequentialReveal: false }, camera: "off", resultsRelease: "manual" },
  { type: "midterm", label: "Midterm", description: "Strict mode, sequential questions, camera optional.", durationMin: 90,
    settings: { integrityMode: "strict", openLimit: 5, cameraCheck: false, sequentialReveal: true }, camera: "optional", resultsRelease: "manual" },
  { type: "final", label: "Final", description: "Highest stakes: strict mode, sequential questions, camera check on.", durationMin: 180,
    settings: { integrityMode: "strict", openLimit: 5, cameraCheck: true, sequentialReveal: true }, camera: "on", resultsRelease: "manual" },
];

const uniqueCells = (cells: z.infer<typeof blueprintCell>[]) =>
  new Set(cells.map((cell) => JSON.stringify([cell.topic, cell.difficulty]))).size === cells.length;

const sectionFields = {
  title: z.string().trim().min(1).max(150),
  instructions: z.string().trim().max(8_000),
  /** Empty = any question type. */
  allowedTypes: z.array(questionType).max(3).refine((types) => new Set(types).size === types.length, "Use each type once."),
  shuffle: z.boolean(),
  /** Empty = every question in the section appears on each paper. */
  blueprint: z.array(blueprintCell).max(100).refine(uniqueCells, "Use unique topic/difficulty cells."),
  /** Overrides each question's own marks inside this section. */
  marksPerQuestion: marks.nullable(),
};

export const sectionInput = z.object({
  title: sectionFields.title,
  instructions: sectionFields.instructions.default(""),
  allowedTypes: sectionFields.allowedTypes.default([]),
  shuffle: sectionFields.shuffle.default(true),
  blueprint: sectionFields.blueprint.default([]),
  marksPerQuestion: sectionFields.marksPerQuestion.default(null),
}).strict();
export const sectionPatch = z.object({ id, ...Object.fromEntries(Object.entries(sectionFields).map(([key, schema]) => [key, schema.optional()])) as {
  [K in keyof typeof sectionFields]: z.ZodOptional<(typeof sectionFields)[K]>
} }).strict().refine((patch) => Object.keys(patch).length > 1, "Choose a change.");
export const sectionReorder = z.object({
  sectionIds: z.array(id).min(1).max(50).refine((ids) => new Set(ids).size === ids.length, "Use each section once."),
}).strict();
export const sectionImport = questionImport.extend({
  /** Defaults to the exam's course. */
  course: course.optional(),
  tags: tags.optional(),
}).strict();

export type SectionInput = z.infer<typeof sectionInput>;
export type SectionPatch = z.infer<typeof sectionPatch>;
