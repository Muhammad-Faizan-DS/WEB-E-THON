"use client";

import Link from "next/link";
import { useState } from "react";
import type { ExamType } from "@/lib/contracts/core";
import { DataTable, Status, formatDate } from "./common";

export type ExamListRow = {
  id: string; title: string; course: string; examType: ExamType; startsAt: string; endsAt: string; durationMin: number;
  status: "draft" | "scheduled" | "open" | "closed" | "results_published";
};
const filters = [["all", "All statuses"], ["draft", "Draft"], ["scheduled", "Scheduled"], ["open", "Open"],
  ["closed", "Closed"], ["results_published", "Results published"]];

export function ExamDirectory({ exams }: { exams: ExamListRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const visible = exams.filter((exam) => (status === "all" || exam.status === status) &&
    `${exam.title} ${exam.course}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="panel">
    <div className="exam-list-controls">
      <label>Search exams<input type="search" value={query} placeholder="Title or course" onChange={(event) => setQuery(event.target.value)} /></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>
        {filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {visible.length ? <DataTable headers={["Exam", "Status", "Availability", "Duration"]} rows={visible.map((exam) => [
      <div key="exam"><Link href={"/portal/examiner/exams/" + exam.id + "?tab=questions"}>{exam.title}</Link>
        <small>{exam.course ? exam.course + " · " : ""}<span style={{ textTransform: "capitalize" }}>{exam.examType}</span></small></div>,
      <Status key="status" value={exam.status} />,
      <div key="window"><span>{formatDate(exam.startsAt)}</span><small>Closes {formatDate(exam.endsAt)}</small></div>,
      exam.durationMin + " min",
    ])} /> : <p className="empty">{exams.length ? "No exams match these filters." : "Create your first exam to start adding questions."}</p>}
  </section>;
}
