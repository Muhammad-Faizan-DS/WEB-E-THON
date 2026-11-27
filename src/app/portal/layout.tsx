import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./secureexam.css";

export const metadata: Metadata = { description: "Secure, fair and explainable online examinations." };

/** Working portal on the real API, kept under /portal so the frontend's top-level pages never collide with it. */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <div className="portal-root">{children}</div>;
}
