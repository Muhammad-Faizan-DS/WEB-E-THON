import Link from "next/link";
import "../../portal/secureexam.css";
import { verifyCode } from "@/lib/contracts/operations";
import { verifyReport } from "@/server/reports";

export const dynamic = "force-dynamic";
export default async function Verification({ params }: { params: Promise<{ code: string }> }) {
  const code = verifyCode.safeParse((await params).code);
  const result = code.success ? await verifyReport(code.data) : { valid: false as const };
  return <main className="verify panel">
    <Link href="/" className="brand"><span aria-hidden="true">F</span>Fairmark</Link>
    <h1>{result.valid ? "Verified result" : "Report could not be verified"}</h1>
    {result.valid && <dl className="facts"><div><dt>Candidate</dt><dd>{result.name}</dd></div><div><dt>Exam</dt><dd>{result.exam}</dd></div>
      <div><dt>Score</dt><dd>{result.score} / {result.totalMarks}</dd></div><div><dt>Submitted</dt><dd>{result.date}</dd></div></dl>}
  </main>;
}
