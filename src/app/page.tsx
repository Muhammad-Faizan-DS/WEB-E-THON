"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Me } from "@/contracts";
import { api } from "@/lib/client/api";
import { ROLE_HOME } from "@/lib/client/me";
import { Logo } from "@/components/common/brand";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    api.get("/api/auth/me", Me).then((m) => router.replace(ROLE_HOME[m.role]), () => router.replace("/login"));
  }, [router]);
  return (
    <main className="grid min-h-dvh place-items-center">
      <Logo className="animate-pulse text-lg" />
    </main>
  );
}
