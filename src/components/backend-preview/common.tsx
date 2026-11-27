import Link from "next/link";
import type { ReactNode } from "react";

export function Heading({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return <div className="heading"><div><h1>{title}</h1>{note && <p>{note}</p>}</div>{action}</div>;
}
export function Navigation({ items, selected }: { items: Array<[string, string]>; selected: string }) {
  return <nav aria-label="Workspace" className="tabs">{items.map(([text, href]) =>
    <Link key={href} href={href} aria-current={href === selected ? "page" : undefined}>{text}</Link>)}</nav>;
}
export function Feedback({ error, note, pending }: { error?: string; note?: string; pending?: boolean }) {
  return <>{error && <p role="alert" className="error">{error}</p>}
    {note && <p className="notice" role="status">{note}</p>}{pending && <p className="muted" role="status">Loading…</p>}</>;
}
export function Status({ value }: { value: string }) {
  return <span className="pill" data-status={value}>{value.replaceAll("_", " ")}</span>;
}
export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return rows.length ? <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>
    : <p className="empty">Nothing to show yet.</p>;
}
export function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}
