/**
 * Fictional demo data mirroring PRD §14. Times are relative to `epoch` (first load),
 * so the demo always has an ongoing, an upcoming and a completed exam.
 */
import type { ExamSettings, Preferences, Role } from "@/contracts";

export const DEMO_PASSWORD = "Demo@2026";

export interface MockUser { id: string; name: string; email: string; role: Role; isActive: boolean; studentId?: string; preferences?: Partial<Preferences> }

export const USERS: MockUser[] = [
  { id: "a0000000-0000-4000-8000-000000000001", name: "Ayesha Admin", email: "admin@exam.test", role: "admin", isActive: true },
  { id: "b0000000-0000-4000-8000-000000000001", name: "Dr. Hina Rauf", email: "examiner@exam.test", role: "examiner", isActive: true },
  { id: "b0000000-0000-4000-8000-000000000002", name: "Mr. Bilal Qadir", email: "examiner2@exam.test", role: "examiner", isActive: true },
  { id: "c0000000-0000-4000-8000-000000000001", name: "Ali Khan", email: "ali@exam.test", role: "candidate", isActive: true, studentId: "FA23-BCS-001" },
  { id: "c0000000-0000-4000-8000-000000000002", name: "Sara Ahmed", email: "sara@exam.test", role: "candidate", isActive: true, studentId: "FA23-BCS-002" },
  { id: "c0000000-0000-4000-8000-000000000003", name: "Omar Farooq", email: "omar@exam.test", role: "candidate", isActive: true, studentId: "FA23-BCS-003" },
  // simulated cohort for the live monitor (they never sign in during the demo)
  { id: "d0000000-0000-4000-8000-000000000001", name: "Hamza Siddiqui", email: "cand01@exam.test", role: "candidate", isActive: true, studentId: "FA23-BCS-014" },
  { id: "d0000000-0000-4000-8000-000000000002", name: "Zainab Malik", email: "cand02@exam.test", role: "candidate", isActive: true, studentId: "FA23-BCS-022" },
  { id: "d0000000-0000-4000-8000-000000000003", name: "Usman Tariq", email: "cand03@exam.test", role: "candidate", isActive: true, studentId: "FA23-BCS-031" },
  { id: "d0000000-0000-4000-8000-000000000004", name: "Fatima Noor", email: "cand04@exam.test", role: "candidate", isActive: true, studentId: "FA23-BCS-040" },
  { id: "d0000000-0000-4000-8000-000000000005", name: "Ahmed Raza", email: "cand05@exam.test", role: "candidate", isActive: true, studentId: "FA23-BCS-047" },
];

export interface MockQuestion {
  id: string;
  type: "single" | "multi" | "written";
  topic: string;
  prompt: string;
  marks: number;
  options?: { id: string; label: string }[];
  key?: string[];
  multiRule?: "exact" | "partial";
}

export interface MockExam {
  id: string;
  code: string;
  title: string;
  ownerId: string;
  status: "draft" | "published";
  opensOffsetMin: number;
  closesOffsetMin: number;
  durationMin: number;
  totalMarks: number;
  instructions: string;
  settings: ExamSettings;
  questions: MockQuestion[];
  enrolled: string[]; // candidate user ids
  resultsPublished: boolean;
}

const strictSettings: ExamSettings = {
  shuffleQuestions: false, shuffleOptions: true, pastePolicy: "block", fullscreenRequired: true,
  allowMobile: false, maxOpens: 3, maxReattempts: 1, showBreakdown: true, cameraCheck: "off",
};

const ALI = USERS[3].id, SARA = USERS[4].id, OMAR = USERS[5].id;
export const SIMULATED = USERS.slice(6).map((u) => u.id);
const H = 60;

export const EXAMS: MockExam[] = [
  {
    id: "e1000000-0000-4000-8000-000000000001",
    code: "DSF-101",
    title: "Data Science Fundamentals",
    ownerId: USERS[1].id,
    status: "published",
    opensOffsetMin: -1 * H,
    closesOffsetMin: 9 * H,
    durationMin: 20,
    totalMarks: 10,
    instructions:
      "Answer all three questions. You have 20 minutes once you start, and the exam closes at the time shown even if you start late.\n\nMultiple-select questions are marked by exact match: you get the marks only if you select every correct option and no incorrect ones.\n\nYour answers save automatically. If your connection drops, keep working: answers are kept on this device and sent when you reconnect.",
    settings: strictSettings,
    questions: [
      {
        id: "q1", type: "single", topic: "Statistics", marks: 2,
        prompt: "Which statistic is least affected by an extreme outlier?",
        options: [
          { id: "a", label: "Mean" }, { id: "b", label: "Median" }, { id: "c", label: "Range" }, { id: "d", label: "Variance" },
        ],
        key: ["b"],
      },
      {
        id: "q2", type: "multi", topic: "Machine Learning", marks: 3, multiRule: "exact",
        prompt: "Select all of the supervised learning tasks.",
        options: [
          { id: "a", label: "Classification" }, { id: "b", label: "Clustering" }, { id: "c", label: "Regression" }, { id: "d", label: "Dimensionality reduction" },
        ],
        key: ["a", "c"],
      },
      {
        id: "q3", type: "written", topic: "Model Evaluation", marks: 5,
        prompt:
          "A model achieves 98% accuracy on a dataset where only 2% of the examples are positive. Explain why this accuracy could be misleading, and name one other measure you would inspect.",
      },
    ],
    enrolled: [ALI, SARA, OMAR, ...SIMULATED],
    resultsPublished: false,
  },
  {
    id: "e1000000-0000-4000-8000-000000000004",
    code: "EXP-2",
    title: "Expiry Demo Quiz",
    ownerId: USERS[1].id,
    status: "published",
    opensOffsetMin: -30,
    closesOffsetMin: 9 * H,
    durationMin: 2,
    totalMarks: 2,
    instructions: "A two-minute quiz to show what happens when time runs out. Your accepted answers are submitted automatically at the deadline.",
    settings: { ...strictSettings, fullscreenRequired: false, pastePolicy: "allow", allowMobile: true },
    questions: [
      { id: "x1", type: "single", topic: "Statistics", marks: 1, prompt: "What is the median of 3, 9, 4, 1, 7?", options: [{ id: "a", label: "4" }, { id: "b", label: "7" }, { id: "c", label: "4.8" }, { id: "d", label: "9" }], key: ["a"] },
      { id: "x2", type: "single", topic: "Statistics", marks: 1, prompt: "A p-value of 0.03 at α = 0.05 means you…", options: [{ id: "a", label: "Fail to reject the null hypothesis" }, { id: "b", label: "Reject the null hypothesis" }, { id: "c", label: "Accept the alternative with 97% certainty" }], key: ["b"] },
    ],
    enrolled: [ALI, SARA],
    resultsPublished: false,
  },
  {
    id: "e1000000-0000-4000-8000-000000000003",
    code: "ML-MID",
    title: "Machine Learning Midterm",
    ownerId: USERS[1].id,
    status: "published",
    opensOffsetMin: 22 * H,
    closesOffsetMin: 25 * H,
    durationMin: 90,
    totalMarks: 40,
    instructions: "Covers weeks 1–7. Calculators are not needed.",
    settings: strictSettings,
    questions: Array.from({ length: 12 }, (_, i) => ({ id: `m${i + 1}`, type: "single" as const, topic: "ML", prompt: `Question ${i + 1}`, marks: i < 8 ? 3 : 4, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], key: ["a"] })),
    enrolled: [ALI],
    resultsPublished: false,
  },
  {
    id: "e1000000-0000-4000-8000-000000000002",
    code: "STAT-Q1",
    title: "Statistics Quiz 1",
    ownerId: USERS[1].id,
    status: "published",
    opensOffsetMin: -3 * 24 * H,
    closesOffsetMin: -3 * 24 * H + 2 * H,
    durationMin: 45,
    totalMarks: 30,
    instructions: "Ten questions on descriptive statistics.",
    settings: strictSettings,
    questions: [],
    enrolled: [ALI, SARA],
    resultsPublished: true,
  },
  {
    id: "e1000000-0000-4000-8000-000000000005",
    code: "DRAFT-B",
    title: "Examiner 2 Draft",
    ownerId: USERS[2].id,
    status: "draft",
    opensOffsetMin: 3 * 24 * H,
    closesOffsetMin: 3 * 24 * H + 2 * H,
    durationMin: 30,
    totalMarks: 20,
    instructions: "",
    settings: strictSettings,
    questions: [],
    enrolled: [],
    resultsPublished: false,
  },
];

/** Static published results for the completed exam (by candidate). */
export const PUBLISHED_SCORES: Record<string, number> = { [ALI]: 76.7, [SARA]: 83.3 };
export const STAT_Q1_QUESTION_COUNT = 10;
