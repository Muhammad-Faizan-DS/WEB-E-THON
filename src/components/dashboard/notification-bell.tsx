"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { request, useResource } from "@/components/backend-preview/client";

type Notification = { id: string; kind: string; title: string; body: string; link: string | null; createdAt: string; readAt: string | null };
type Feed = { unread: number; items: Notification[] };

const ago = (value: string) => {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1_000));
  return seconds < 60 ? "just now" : seconds < 3_600 ? `${Math.floor(seconds / 60)} min ago` : seconds < 86_400 ? `${Math.floor(seconds / 3_600)} h ago` : new Date(value).toLocaleDateString();
};

/** Notification bar for every portal: unread badge, latest 30 items, mark read. Polls every 15 s while the tab is visible. */
export function NotificationBell() {
  const feed = useResource<Feed>("/api/notifications", 15_000);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = feed.data?.unread ?? 0;
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  async function read(body: { ids?: string[]; all?: boolean }) {
    try { await request("/api/notifications", "POST", body); await feed.reload(); } catch { /* the next poll retries */ }
  }
  return <div className="bell" ref={box}>
    <button className="bell-button" aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => setOpen((value) => !value)}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      {unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
    </button>
    {open && <div className="bell-panel" role="dialog" aria-label="Notifications">
      <div className="section-row"><strong>Notifications</strong>{unread > 0 && <button className="link small" onClick={() => void read({ all: true })}>Mark all read</button>}</div>
      {!feed.data?.items.length && <p className="empty">You&apos;re all caught up.</p>}
      <ul>{feed.data?.items.map((item) => <li key={item.id} data-unread={!item.readAt}>
        {item.link ? <Link href={item.link} onClick={() => { setOpen(false); if (!item.readAt) void read({ ids: [item.id] }); }}><strong>{item.title}</strong></Link>
          : <strong>{item.title}</strong>}
        {item.body && <p>{item.body}</p>}
        <small>{ago(item.createdAt)}{!item.readAt && <> · <button className="link small" onClick={() => void read({ ids: [item.id] })}>Mark read</button></>}</small>
      </li>)}</ul>
    </div>}
  </div>;
}
