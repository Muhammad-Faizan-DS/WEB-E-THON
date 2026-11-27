"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster position="bottom-center" closeButton toastOptions={{ className: "font-sans !rounded-lg !border-border !bg-surface !text-foreground !shadow-lg" }} />
    </ThemeProvider>
  );
}
