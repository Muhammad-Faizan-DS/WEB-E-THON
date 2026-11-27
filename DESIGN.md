# DESIGN.md: Fairmark visual system

Read this before changing any UI. It is the design contract for every screen; `src/app/globals.css` holds the tokens.
Built with guidance from impeccable, ibelick/ui-skills, Emil Kowalski's skills and ui-ux-pro-max. Craft bar set by the owner's references: Linear, TIB Digital, nk.studio and Treeunfe.

## The look: dark brand bands, light working surfaces

- **Glass, on dark bands only:** the homepage product frame is frosted glass (`bg-white/4%`, `backdrop-blur-2xl`, a light top edge, coloured light behind it), with glass inner panels and glass buttons; hero and nav buttons on the dark band are glass pills. Glass never appears on light app screens, and an element with backdrop blur must not sit inside an ancestor that animates opacity or has a filter or mask (that hides the backdrop).
- **Marketing (homepage, login brand panel):** near-black bands (`--night`) with one emerald glow, a Vanta DOTS emerald floor in the homepage hero, huge tight Montserrat headlines, and real product UI in crisp dark frames. Explanations live on white and cool off-white sections.
- **App screens (candidate, examiner, admin):** light, calm and dense where needed. Cool neutral surfaces, hairline borders, one emerald accent. People use them under pressure, so the tool disappears into the task (impeccable "Operate" mode).
- **One accent: emerald.** Primary actions, the current selection, focus and links. Never as decoration or a background wash on app screens.
- **Status is a dot plus a word.** Colour goes only on the dot or icon; the label stays ink. Only *Priority* and destructive or error states use coloured text.

## Tokens (see globals.css)

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F6F7F6` | `#07090A` | app canvas, off-white homepage sections |
| `surface` | `#FFFFFF` | `#0E1211` | sheets, tables, inputs, white homepage sections |
| `surface-2` | `#EEF1EF` | `#161C1A` | toolbars, table heads, wells, selected rows |
| `foreground` | `#0B0F0D` | `#EDF2EF` | primary text |
| `muted-foreground` | `#4B5551` | `#A3AEA8` | secondary text (≥ 7:1 on surface) |
| `border` / `border-strong` | `#E4E7E5` / `#CBD1CD` | `#1F2623` / `#2E3733` | hairlines / control outlines |
| `primary` | `#047857` | `#34D399` | actions, selection, focus (white text on light, `#04130D` on dark) |
| `success` / `warning` / `danger` / `flag` / `info` | green / amber / red / violet / blue | | status dots, icons, critical text |
| `night`, `night-2`, `night-3`, `on-night`, `on-night-muted`, `emerald`, `emerald-bright` | fixed | fixed | homepage and login brand bands only |

## Type

- **Poppins** (400/500/600) is the UI voice: controls, labels, data and body text. App base size 14 px; homepage body 15–19 px.
- **Montserrat** (600/700/800) is the display voice: `h1`–`h3` everywhere, the wordmark and homepage headlines. Homepage display uses `.display` (−0.035em tracking, leading 1, max 6rem).
- **Source Serif 4** only for **reading content**: question prompts, exam instructions and incident explanations (`.q-text`, `.prose-read`).
- **IBM Plex Mono** only for identifiers: receipt codes, exam codes, student IDs and timestamps in logs.
- Use `tabular-nums` wherever numbers line up (timers, counts, scores, times). No eyebrows or kickers above headings.

## Layout and spacing

- 4 px grid. Tight inside groups (4–8), generous between sections (32–48 in the app, 96–128 on the homepage). More space above a heading than below it.
- **No card grids as page structure.** Use sections separated by space and hairline rules. Summary numbers live in a single **stat strip** (one bordered row with divided cells).
- **Never nest cards.** A surface inside a surface is a well (`surface-2`) or a rule.
- Max content width 72–76 rem; reading measure 58–72 ch.

## Components

- **Buttons:** 36 px default (40 px `lg`), radius 6 px in the app. The homepage uses pill buttons (emerald on dark, ink on light). One primary per view.
- **Status:** `<Status tone="…">Label</Status>` is a dot plus text. Badges (outlined) only for counts and categorical tags.
- **Tables:** hairline rows, `surface-2` header, row hover, 44 px+ rows, right-aligned actions.
- **Tabs:** underline tabs; no pill segmented controls.
- **Progress is an answer strip** (`AnswerStrip`): one cell per question, like a row of answer-sheet boxes. Filled = answered and accepted by the server, amber stripes = kept on the device, outlined = the question on screen, empty = not answered. Never a generic rounded bar.
- **Dialogs and sheets:** dialogs only for decisions that need protected focus (submit, approve or deny, close exam). Side sheets for "act without leaving" panels, such as the monitor's candidate panel.

## Motion

- App: 150–200 ms ease-out on state changes only (hover, selection, save-status crossfade). No entrance choreography.
- Homepage: one CSS-only entrance for the hero (rise + blur, staggered), Vanta DOTS behind it, React Bits DecryptedText on the verify code, and interaction-driven demos. Vanta loads after first paint, only at ≥ 768 px, never with reduced motion.
- Always respect `prefers-reduced-motion` and the account's reduced-motion preference (`.reduce-motion`).

## Browser surfaces

Text selection, caret, focus ring (2 px emerald, 2 px offset), scrollbars and `accent-color` all come from the palette.

## Never

Gradient text, glass on light app screens, eyebrow labels above headings, a coloured bar down one side of a box, hard offset shadows, emoji as icons, paper or grid textures, colour as the only signal, and invented customers, stats or testimonials (sample data is labelled as sample).
