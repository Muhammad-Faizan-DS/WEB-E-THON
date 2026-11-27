"use client";
import * as React from "react";
import { get, set } from "idb-keyval";
import { Keyboard, NotebookPen, SlidersHorizontal } from "lucide-react";
import type { Preferences } from "@/contracts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch, Kbd } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const TEXT_SIZES: Record<Preferences["textSize"], string> = { sm: "0.9375rem", md: "1.0625rem", lg: "1.25rem", xl: "1.5rem" };

/** Attempt-scoped notes. Stored only on this device, never sent for grading (PRD 4.8). */
export function Scratchpad({ storageKey }: { storageKey: string }) {
  const [text, setText] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);
  const t = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => { get(storageKey).then((v) => { setText((v as string) ?? ""); setLoaded(true); }).catch(() => setLoaded(true)); }, [storageKey]);
  return (
    <div className="flex h-full flex-col gap-2">
      <label htmlFor="scratchpad" className="text-sm font-medium">Rough work</label>
      <textarea
        id="scratchpad"
        value={text}
        disabled={!loaded}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (t.current) clearTimeout(t.current);
          t.current = setTimeout(() => set(storageKey, v).catch(() => {}), 400);
        }}
        className="min-h-72 flex-1 resize-none rounded-lg border border-input bg-[repeating-linear-gradient(transparent,transparent_1.6rem,var(--border)_1.6rem,var(--border)_calc(1.6rem+1px))] p-3 font-mono text-sm leading-[1.6rem]"
        placeholder="Working, calculations, outlines…"
        aria-describedby="scratch-help"
      />
      <p id="scratch-help" className="text-xs text-muted-foreground">Kept on this device for this attempt only. Not marked and not seen by your examiner.</p>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string; style?: React.CSSProperties }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.v} className={cn("flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring")} style={o.style}>
            <input type="radio" className="sr-only" name={label} value={o.v} checked={value === o.v} onChange={() => onChange(o.v)} />
            {o.l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DisplaySettings({ prefs, onChange }: { prefs: Preferences; onChange: (p: Partial<Preferences>) => void }) {
  return (
    <div className="space-y-6">
      <Choice label="Text size" value={prefs.textSize} onChange={(v) => onChange({ textSize: v })}
        options={(["sm", "md", "lg", "xl"] as const).map((v) => ({ v, l: { sm: "A", md: "A", lg: "A", xl: "A" }[v], style: { fontSize: TEXT_SIZES[v] } }))} />
      <Choice label="Layout for written questions" value={prefs.layout} onChange={(v) => onChange({ layout: v })}
        options={[{ v: "single", l: "Stacked" }, { v: "split", l: "Side by side" }]} />
      <Choice label="Question list position" value={prefs.navigatorPosition} onChange={(v) => onChange({ navigatorPosition: v })}
        options={[{ v: "left", l: "Left" }, { v: "right", l: "Right" }]} />
      <Choice label="Theme" value={prefs.theme} onChange={(v) => onChange({ theme: v })}
        options={[{ v: "light", l: "Light" }, { v: "dark", l: "Dark" }, { v: "system", l: "Match device" }]} />
      <label className="flex items-center justify-between gap-4 text-sm font-medium">
        Reduce motion
        <Switch checked={prefs.reduceMotion} onCheckedChange={(v) => onChange({ reduceMotion: v })} />
      </label>
      <p className="text-xs text-muted-foreground">Saved to your account and used in every exam.</p>
    </div>
  );
}

export function Shortcuts() {
  const rows: [string, string][] = [["Alt + →", "Next question"], ["Alt + ←", "Previous question"], ["Alt + F", "Mark for review"], ["Alt + R", "Review & submit"], ["Alt + T", "Open tools"]];
  return (
    <ul className="space-y-2 text-sm">
      {rows.map(([k, d]) => <li key={k} className="flex items-center justify-between"><span>{d}</span><Kbd>{k}</Kbd></li>)}
    </ul>
  );
}

export function ToolsTabs({ storageKey, prefs, onPrefs, defaultTab = "scratch" }: { storageKey: string; prefs: Preferences; onPrefs: (p: Partial<Preferences>) => void; defaultTab?: string }) {
  return (
    <Tabs defaultValue={defaultTab} className="flex h-full flex-col">
      <TabsList className="w-full">
        <TabsTrigger value="scratch" className="flex-1"><NotebookPen className="size-4" aria-hidden />Scratchpad</TabsTrigger>
        <TabsTrigger value="display" className="flex-1"><SlidersHorizontal className="size-4" aria-hidden />Display</TabsTrigger>
        <TabsTrigger value="keys" className="flex-1"><Keyboard className="size-4" aria-hidden /><span className="sr-only">Keyboard shortcuts</span></TabsTrigger>
      </TabsList>
      <TabsContent value="scratch" className="flex-1"><Scratchpad storageKey={storageKey} /></TabsContent>
      <TabsContent value="display"><DisplaySettings prefs={prefs} onChange={onPrefs} /></TabsContent>
      <TabsContent value="keys"><Shortcuts /></TabsContent>
    </Tabs>
  );
}
