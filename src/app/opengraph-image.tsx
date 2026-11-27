import { ImageResponse } from "next/og";

export const alt = "Fairmark: exams you can trust, even when the Wi-Fi can't";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card: the homepage's dark band and headline, generated at build time (no external fonts or services). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "72px 80px", background: "radial-gradient(70% 60% at 50% 0%, rgba(16,185,129,0.35), #07090a 70%)", color: "#edf2ef",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
          <svg width="44" height="44" viewBox="0 0 20 20"><rect x="1.5" y="1.5" width="17" height="17" rx="5" fill="none" stroke="#10b981" strokeWidth="1.8" /><path d="m5.6 10.4 2.9 2.9 5.9-6.6" fill="none" stroke="#10b981" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Fairmark
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, maxWidth: 900 }}>Exams you can trust, even when the Wi-Fi can&apos;t.</div>
          <div style={{ fontSize: 28, color: "#9aa6a0", maxWidth: 900 }}>Server-kept time, a receipt for every answer, and integrity observations explained to a person.</div>
        </div>
      </div>
    ),
    size,
  );
}
