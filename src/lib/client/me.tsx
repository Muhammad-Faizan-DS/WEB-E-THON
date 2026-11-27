"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Me, type Preferences, type Role } from "@/contracts";
import { api } from "./api";

interface MeCtx { me: Me; setPreferences: (p: Partial<Preferences>) => Promise<void>; logout: () => Promise<void> }
const Ctx = React.createContext<MeCtx | null>(null);

export const ROLE_HOME: Record<Role, string> = { admin: "/admin", examiner: "/examiner", candidate: "/candidate" };

/** Loads the signed-in user and enforces the role for this section (UX only; the API enforces for real). */
export function MeProvider({ role, children, fallback }: { role: Role | Role[]; children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [me, setMe] = React.useState<Me | null>(null);
  const roles = Array.isArray(role) ? role : [role];
  const roleKey = roles.join(",");

  React.useEffect(() => {
    let alive = true;
    api.get("/api/auth/me", Me).then(
      (m) => {
        if (!alive) return;
        if (!roleKey.split(",").includes(m.role)) { router.replace(ROLE_HOME[m.role]); return; }
        setMe(m);
        if (m.role === "candidate") setTheme(m.preferences.theme);
        document.documentElement.classList.toggle("reduce-motion", m.preferences.reduceMotion);
      },
      () => router.replace(`/login?next=${encodeURIComponent(location.pathname)}`),
    );
    return () => { alive = false; };
  }, [roleKey, router, setTheme]);

  const value = React.useMemo<MeCtx | null>(() => me && {
    me,
    setPreferences: async (p) => {
      const next = { ...me.preferences, ...p };
      setMe({ ...me, preferences: next });
      if (p.theme) setTheme(p.theme);
      if (p.reduceMotion !== undefined) document.documentElement.classList.toggle("reduce-motion", p.reduceMotion);
      try { await api.put("/api/me/preferences", next); } catch { /* kept locally; retried on next change */ }
    },
    logout: async () => {
      try { await api.post("/api/auth/logout"); } finally { router.replace("/login"); }
    },
  }, [me, router, setTheme]);

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMe() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useMe must be used inside MeProvider");
  return v;
}
