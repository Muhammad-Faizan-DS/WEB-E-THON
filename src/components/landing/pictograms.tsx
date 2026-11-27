/**
 * Fairmark's own pictograms for the homepage diagrams: one hand-drawn set on a 24 px grid, 1.6 px rounded
 * strokes, with a single accent detail each. The accent colour comes from --pg-accent (emerald on light
 * stops, the stop's text colour on filled ones), so the same icon works in every state.
 */
import * as React from "react";

type P = React.SVGProps<SVGSVGElement>;
const A = { stroke: "var(--pg-accent, currentColor)" } as const;

function Svg({ children, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      {children}
    </svg>
  );
}

/** a sheet with a pencil stroke: building the paper */
export const PaperPencil = (p: P) => (
  <Svg {...p}><path d="M6 3h8l4 4v6" /><path d="M14 3v4h4" /><path d="M6 3v18h6" /><path d="M9 10h5M9 13h3" /><path {...A} d="m14.5 20.5 5.6-5.6a1.4 1.4 0 0 0-2-2l-5.6 5.6-.6 2.6z" /></Svg>
);
/** a paper plane leaving a dotted trail: publish and enrol */
export const PlaneSend = (p: P) => (
  <Svg {...p}><path d="M21 3 3 10.5l7 2.5 2.5 7z" /><path d="m10 13 4.5-4.5" /><path {...A} d="M3 17h.01M5.5 19.5h.01M3 21h.01" strokeWidth={2.4} /></Svg>
);
/** an ID card with a tick: identity verified */
export const IdTick = (p: P) => (
  <Svg {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.2" /><circle cx="8" cy="10.5" r="2" /><path d="M5 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2" /><path d="M14 9.5h4.5" /><path {...A} d="m14 14.5 1.6 1.6 3.2-3.4" /></Svg>
);
/** a laptop with a clock on screen: taking the exam on server time */
export const LaptopClock = (p: P) => (
  <Svg {...p}><rect x="4" y="4.5" width="16" height="11" rx="1.6" /><path d="M2 19.5h20" /><path d="M9.5 19.5h5" /><circle {...A} cx="12" cy="10" r="3" /><path {...A} d="M12 8.6V10l1 .7" /></Svg>
);
/** a torn receipt with a tick: submitted with a receipt */
export const ReceiptTick = (p: P) => (
  <Svg {...p}><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" /><path d="M9 7.5h6M9 10.5h4" /><path {...A} d="m9.5 14.5 1.7 1.7 3.6-3.7" /></Svg>
);
/** a clipboard with marked rows: review and grade */
export const ClipboardMarks = (p: P) => (
  <Svg {...p}><rect x="5" y="4" width="14" height="17.5" rx="2" /><path d="M9 4V2.8h6V4" /><path {...A} d="m8.4 10 1.3 1.3 2.3-2.4M8.4 15.5l1.3 1.3 2.3-2.4" /><path d="M14 10h2.6M14 15.5h2.6" /></Svg>
);
/** a certificate with a QR corner and a ribbon: results anyone can verify */
export const CertificateQr = (p: P) => (
  <Svg {...p}><rect x="2.5" y="4" width="19" height="13" rx="1.6" /><path d="M5.5 8h7M5.5 11h5" /><path {...A} d="M15 7.5h3v3h-3zM15 13h.01M17 13h1" /><path d="M7.5 17v4l2-1.2 2 1.2v-4" /></Svg>
);

/** a server with a clock badge: the server keeps time */
export const ServerClock = (p: P) => (
  <Svg {...p}><rect x="2.5" y="4" width="13" height="6" rx="1.5" /><rect x="2.5" y="12.5" width="9" height="6" rx="1.5" /><path d="M5.5 7h.01M5.5 15.5h.01" strokeWidth={2.4} /><circle {...A} cx="17.5" cy="16" r="4.2" /><path {...A} d="M17.5 14v2.1l1.3.9" /></Svg>
);
/** a clock with a padlock: the deadline is locked */
export const ClockLock = (p: P) => (
  <Svg {...p}><circle cx="10.5" cy="10.5" r="7.5" /><path d="M10.5 6.5v4l2.6 1.6" /><rect {...A} x="15" y="15.5" width="6.5" height="5.5" rx="1.2" /><path {...A} d="M16.5 15.5V14a1.75 1.75 0 0 1 3.5 0v1.5" /></Svg>
);
/** a phone showing a clock: the device's own clock */
export const DeviceClock = (p: P) => (
  <Svg {...p}><rect x="6.5" y="2.5" width="11" height="19" rx="2.2" /><path d="M10.5 18.5h3" /><circle cx="12" cy="10" r="3.2" /><path d="M12 8.5V10l1.1.8" /></Svg>
);
/** a pen writing on a line: answering */
export const PenWrite = (p: P) => (
  <Svg {...p}><path d="m14.5 4.5 5 5L9 20H4v-5z" /><path d="m12.5 6.5 5 5" /><path {...A} d="M13 20.5h7" /></Svg>
);
/** a phone storing an answer: kept on the device */
export const DeviceSave = (p: P) => (
  <Svg {...p}><rect x="6" y="2.5" width="12" height="19" rx="2.2" /><path {...A} d="M12 6.5v6.5M9.5 10.5 12 13l2.5-2.5" /><path d="M9.5 16.5h5" /></Svg>
);
/** a server with a tick: the server's receipt */
export const ServerTick = (p: P) => (
  <Svg {...p}><rect x="3" y="3.5" width="18" height="7" rx="1.6" /><rect x="3" y="13.5" width="18" height="7" rx="1.6" /><path d="M6.5 7h.01M6.5 17h.01" strokeWidth={2.4} /><path {...A} d="m12.5 17 1.6 1.6 3.4-3.4" /></Svg>
);
/** an eye: something was observed */
export const EyeObserve = (p: P) => (
  <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle {...A} cx="12" cy="12" r="2.8" /></Svg>
);
/** a note grouping lines under a bracket: one explained incident */
export const IncidentNote = (p: P) => (
  <Svg {...p}><path d="M7 3h7.5L19 7.5V21H7z" /><path d="M14.5 3v4.5H19" /><path {...A} d="M9.5 10.5v7" /><path d="M11.5 11h4.5M11.5 14h4.5M11.5 17h3" /></Svg>
);
/** a person with a tick: a person decides */
export const PersonDecide = (p: P) => (
  <Svg {...p}><circle cx="9.5" cy="8" r="3.6" /><path d="M3 20c.8-3.7 3.4-5.6 6.5-5.6 1.6 0 3 .5 4.2 1.4" /><path {...A} d="m15 17.5 2 2 4-4.3" /></Svg>
);
/** a gavel: an automatic penalty (which never happens) */
export const Gavel = (p: P) => (
  <Svg {...p}><path d="m14 3.5 6.5 6.5M11.5 6l6.5 6.5" /><path d="m12.75 4.75-6 6 6.5 6.5 6-6" /><path d="m9.75 13.75-6 6" /><path d="M13 21h8" /></Svg>
);

/** a key turning in a ring: reset access */
export const KeyReset = (p: P) => (
  <Svg {...p}><circle cx="8" cy="15" r="4.2" /><path d="m11 12 8.5-8.5M16.5 6.5l2 2M14.5 8.5l1.5 1.5" /><path {...A} d="M3.5 6.5A8 8 0 0 1 9 3.2M3.5 6.5V3.5M3.5 6.5h3" /></Svg>
);
/** rows arriving into a table, one rejected: bulk import with row checks */
export const ImportRows = (p: P) => (
  <Svg {...p}><rect x="3" y="9" width="18" height="12" rx="1.6" /><path d="M3 13h18M3 17h18" /><path {...A} d="M12 2.5v5M9.5 5 12 7.5 14.5 5" /></Svg>
);
/** a page with time stamps down the side: the audit log */
export const AuditLog = (p: P) => (
  <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path {...A} d="M7.5 7.5h.01M7.5 12h.01M7.5 16.5h.01" strokeWidth={2.4} /><path d="M10.5 7.5h6M10.5 12h6M10.5 16.5h4" /></Svg>
);
/** a megaphone-free live pulse on a screen: monitoring live */
export const LivePulse = (p: P) => (
  <Svg {...p}><rect x="2.5" y="4" width="19" height="13" rx="1.6" /><path d="M8 21h8M12 17v4" /><path {...A} d="M5.5 11h3l1.5-3 2.5 6 1.5-3h4.5" /></Svg>
);
