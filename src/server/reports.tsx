import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Document, Image as PdfImage, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { attempts, exams, reports, users } from "../../db/schema";
import type { Actor } from "./auth";
import { examSummary } from "./analytics";
import { database } from "./database";
import { fail } from "./errors";

function signature(code: string, attemptId: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required.");
  return createHmac("sha256", secret).update("secureexam:report:").update(code).update(attemptId).digest("hex");
}

const result = { attemptId: attempts.id, title: exams.title, totalMarks: exams.totalMarks, score: attempts.scoreCents,
  name: users.name, submittedAt: attempts.submittedAt };

async function resultRow(actor: Actor, id: string) {
  const [row] = await database().select(result).from(attempts)
    .innerJoin(exams, eq(attempts.examId, exams.id)).innerJoin(users, eq(attempts.candidateId, users.id))
    .where(and(eq(attempts.id, id), eq(attempts.isSandbox, false), eq(attempts.status, "graded"), eq(exams.resultsPublished, true),
      actor.role === "candidate" ? eq(attempts.candidateId, actor.id) : eq(exams.examinerId, actor.id)));
  if (!row) fail(403, "FORBIDDEN", "This report is unavailable.");
  return row;
}

export async function verifyReport(code: string) {
  const [row] = await database().select({ ...result, hmac: reports.hmac }).from(reports)
    .innerJoin(attempts, eq(reports.attemptId, attempts.id)).innerJoin(exams, eq(attempts.examId, exams.id))
    .innerJoin(users, eq(attempts.candidateId, users.id)).where(and(eq(reports.verifyCode, code),
      eq(exams.resultsPublished, true), eq(attempts.status, "graded"), eq(attempts.isSandbox, false)));
  if (!row || !/^[a-f0-9]{64}$/.test(row.hmac) || !timingSafeEqual(Buffer.from(row.hmac, "hex"), Buffer.from(signature(code, row.attemptId), "hex"))) {
    return { valid: false as const };
  }
  return { valid: true as const, name: row.name.trim().split(/\s+/).map((word) => word[0] + "***").join(" "), exam: row.title,
    score: (row.score ?? 0) / 100, totalMarks: row.totalMarks, date: row.submittedAt?.toISOString().slice(0, 10) ?? null };
}

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 12, color: "#18252a", fontFamily: "Helvetica" },
  title: { fontSize: 25, marginBottom: 14 },
  rule: { borderTop: "1 solid #d3e3e1", marginVertical: 18 },
  line: { marginBottom: 9 },
  strong: { fontSize: 21, marginTop: 10 },
  image: { width: 95, height: 95, marginVertical: 10 },
  note: { fontSize: 9, color: "#4b5a5e" },
});
const date = (value: Date | null) => value?.toISOString().slice(0, 10) ?? "Unavailable";

export async function candidatePdf(actor: Actor, id: string, requestUrl: string) {
  const row = await resultRow(actor, id);
  const db = database();
  const nonce = randomBytes(20).toString("hex");
  await db.insert(reports).values({ attemptId: id, verifyCode: nonce, hmac: signature(nonce, id) })
    .onConflictDoNothing({ target: reports.attemptId });
  const [report] = await db.select({ code: reports.verifyCode }).from(reports).where(eq(reports.attemptId, id));
  const origin = new URL(process.env.AUTH_URL ?? requestUrl).origin;
  const url = new URL("/verify/" + report.code, origin).href;
  const qr = await QRCode.toDataURL(url, { margin: 1, errorCorrectionLevel: "M" });
  return renderToBuffer(<Document title="SecureExam score report"><Page size="A4" style={styles.page}>
    <Text style={styles.title}>SecureExam score report</Text>
    <Text style={styles.line}>{row.title}</Text><Text style={styles.line}>{row.name}</Text>
    <Text style={styles.note}>Submitted {date(row.submittedAt)} UTC</Text><View style={styles.rule} />
    <Text style={styles.strong}>{(row.score ?? 0) / 100} / {row.totalMarks}</Text>
    <PdfImage src={qr} style={styles.image} /><Text style={styles.note}>Scan to verify the current published result.</Text>
    <Text style={styles.note}>{url}</Text>
  </Page></Document>);
}

export async function summaryPdf(examinerId: string, examId: string) {
  const data = await examSummary(examinerId, examId);
  return renderToBuffer(<Document title="SecureExam exam summary"><Page size="A4" style={styles.page}>
    <Text style={styles.title}>SecureExam exam summary</Text><Text style={styles.line}>{data.title}</Text>
    <View style={styles.rule} /><Text style={styles.line}>Graded candidates: {data.count}</Text>
    <Text style={styles.line}>Mean: {data.mean ?? "Unavailable"} / {data.totalMarks}</Text>
    <Text style={styles.line}>Median: {data.median ?? "Unavailable"}</Text>
    <Text style={styles.line}>Range: {data.min ?? "Unavailable"} to {data.max ?? "Unavailable"}</Text>
    <Text style={styles.line}>Pass rate: {data.passRate === null ? "Unavailable" : `${Math.round(data.passRate * 100)}%`}</Text>
  </Page></Document>);
}
