"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Me, type Preferences, type Role } from "@/contracts";
import { toast } from "sonner";
import { api } from "./api";

interface MeCtx { me: Me; setPreferences: (p: Partial<Preferences>) => Promise<boolean>; logout: () => Promise<void> }
const Ctx = React.createContext<MeCtx | null>(null);

export const ROLE_HOME: Record<Role, string> = { admin: "/admin", examiner: "/examiner", candidate: "/candidate" };

/** Loads the signed-in user and enforces the role for this section (UX only; the API enforces for real). */
export function MeProvider({ role, children, fallback }: { role: Role | Role[]; children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  // next-themes gives setTheme a new identity when the theme changes; reading it through a ref keeps the
  // load effect from re-running and snapping the theme back to the saved one after every toggle
  const setThemeRef = React.useRef(setTheme);
  React.useEffect(() => { setThemeRef.current = setTheme; }, [setTheme]);
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
        if (m.role === "candidate") setThemeRef.current(m.preferences.theme);
        document.documentElement.classList.toggle("reduce-motion", m.preferences.reduceMotion);
      },
      () => router.replace(`/login?next=${encodeURIComponent(location.pathname)}`),
    );
    return () => { alive = false; };
  }, [roleKey, router]);

  const value = React.useMemo<MeCtx | null>(() => me && {
    me,
    setPreferences: async (p) => {
      const next = { ...me.preferences, ...p };
      setMe({ ...me, preferences: next });
      if (p.theme) setTheme(p.theme);
      if (p.reduceMotion !== undefined) document.documentElement.classList.toggle("reduce-motion", p.reduceMotion);
      try {
        await api.put("/api/me/preferences", next);
        return true;
      } catch {
        // say so: the change applies on this device, but the account didn't store it
        toast.warning("Kept on this device only", { description: "We couldn't save this to your account. It will apply here until you sign out." });
        return false;
      }
    },
    logout: async () => {
      try { await api.post("/api/auth/logout"); } catch { /* still leave: the session is cleared or expires */ }
      // a full page load, not a client transition: no cached screens survive, and it works in an old tab too
      window.location.replace(new URL("/login", window.location.origin).href);
    },
  }, [me, setTheme]);

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMe() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useMe must be used inside MeProvider");
  return v;
}
