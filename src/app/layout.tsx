import type { Metadata } from "next";
import { IBM_Plex_Mono, Montserrat, Poppins, Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/common/providers";
import "./globals.css";

/** UI voice: Poppins. Display and page titles: Montserrat. Reading content (questions): Source Serif. Codes: Plex Mono. */
const sans = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-poppins", display: "swap" });
const display = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-montserrat", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-source-serif" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: { default: "Fairmark", template: "%s · Fairmark" },
  description: "Secure, fair and explainable online examinations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
