"use client";
import { Fragment } from "react";
import ScrollVelocity from "@/components/bits/ScrollVelocity";
import { TickBox } from "./marks";

const FEATURES = [
  "Network-aware saving",
  "PDF reports",
  "Sandbox preview",
  "Bulk import",
  "Question analytics",
  "Verifiable results",
  "Workspace preferences",
  "Scratchpad",
];

/** A strip of canary tape across the page carrying the eight secondary features; speeds up with scroll. */
export function FeatureTape() {
  return (
    <div className="relative z-10 -my-3 overflow-x-clip py-3">
      <h2 className="sr-only">Also in Fairmark</h2>
      <ul className="sr-only">
        {FEATURES.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <div aria-hidden className="-mx-4 -rotate-[1.6deg] bg-rb-canary py-3.5 text-rb-ink shadow-[0_10px_24px_-14px_rgb(0_0_0/0.55)]">
        <ScrollVelocity
          texts={[
            <span key="t" className="inline-flex items-center gap-7 pr-7">
              {FEATURES.map((f) => (
                <Fragment key={f}>
                  <span>{f}</span>
                  <TickBox />
                </Fragment>
              ))}
            </span>,
          ]}
          velocity={38}
          numCopies={3}
          className="font-display"
          fontSize="clamp(1.25rem, 2.6vw, 2.1rem)"
          fontWeight={800}
          scrollerStyle={{ filter: "none", letterSpacing: "-0.025em" }}
        />
      </div>
    </div>
  );
}
