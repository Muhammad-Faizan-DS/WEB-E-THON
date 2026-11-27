import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Montserrat, Poppins, Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/common/providers";
import "./globals.css";

/** UI voice: Poppins. Display and page titles: Montserrat. Reading content (questions): Source Serif. Codes: Plex Mono. */
const sans = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-poppins", display: "swap" });
const display = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-montserrat", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-source-serif" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")),
  title: { default: "Fairmark", template: "%s · Fairmark" },
  description: "Secure, fair and explainable online examinations.",
  applicationName: "Fairmark",
  openGraph: { type: "website", siteName: "Fairmark", title: "Fairmark", description: "Secure, fair and explainable online examinations." },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#07090a" },
  ],
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
