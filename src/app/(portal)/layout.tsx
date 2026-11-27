import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./secureexam.css";

export const metadata: Metadata = { title: "SecureExam", description: "Secure examination management" };
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body suppressHydrationWarning>{children}</body></html>;
}
