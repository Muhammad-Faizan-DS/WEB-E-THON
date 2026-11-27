# DESIGN.md: Fairmark visual system

Read this before changing any UI. It is the design contract for every screen; `src/app/globals.css` holds the tokens.
Built with guidance from impeccable (craft floor, Operate mode), ibelick/ui-skills (baseline-ui) and ui-ux-pro-max (accessibility and interaction rules).

## The world: an exam paper

Fairmark is a product people use under pressure, so it should feel like a well-printed exam paper: ink on warm paper, quiet, precise and trustworthy. Brand shows in the details (type, rules, numerals, one ink colour), never in decoration.

- **Mode: Operate.** The tool disappears into the task. Familiar patterns, consistent vocabulary, density where examiners need it.
- **Two voices.** *Public Sans* for the interface (controls, labels, data). *Source Serif 4* only for **reading content**: question prompts, exam instructions, incident explanations, candidate reasons. When a candidate reads a question, it should read like print.
- **One accent: answer-sheet ink blue** (`--primary`). Used for primary actions, current selection, focus and links. Never as decoration or background wash.
- **Status is a dot plus a word.** Colour only on the dot or icon; the label stays ink. Only *Priority* and destructive or error states use coloured text.

## Tokens (see globals.css)

| Token | Light | Use |
|---|---|---|
| `background` | `#F6F5F1` warm paper | page canvas |
| `surface` | `#FFFFFF` | sheets, tables, inputs |
| `surface-2` | `#EFEEE8` | toolbars, table heads, wells, selected rows |
| `foreground` | `#15171C` ink | primary text |
| `muted-foreground` | `#555A66` | secondary text (≥ 7:1 on paper) |
| `border` / `border-strong` | `#E3E1D9` / `#CFCCC1` | hairlines / control outlines |
| `primary` | `#2340C8` ink blue | actions, selection, focus |
| `success` / `warning` / `danger` / `flag` | green / amber / red / violet | status dots, icons, critical text |

Dark mode mirrors each token (night paper `#101216`, ink `#ECEDEF`, ink blue `#8EA2FF`).

## Type scale (fixed rem, ratio ≈ 1.2)

`12 · 13 · 14 (UI base) · 16 (reading base) · 18 · 22 · 28`, with weights 400, 500 and 600 (700 only for numerals in the timer).
- Page title: 22/28 px semibold, `text-balance`.
- Section title: 13 px uppercase is **not** used (no eyebrows or kickers). Sections use 16 px semibold.
- Data: `tabular-nums` everywhere numbers line up (timers, counts, scores, times).
- Mono (IBM Plex Mono) only for identifiers: receipt codes, exam codes, student IDs.

## Layout and spacing

- 4 px grid. Tight inside groups (4–8), generous between sections (32–48). More space above a heading than below it.
- **No card grids as page structure.** Use sections separated by space and hairline rules. Summary numbers live in a single **stat strip** (one bordered row, divided cells), not a grid of cards.
- **Never nest cards.** A surface inside a surface is a well (`surface-2`) or a rule, not another card.
- Content max width 72rem; reading measure 65–72ch.

## Components

- **Buttons:** 36 px default (40 px `lg`), radius 6 px, one primary per view. Secondary = outline on surface. Ghost for tertiary.
- **Status:** `<Status tone="…">Label</Status>`, a dot plus text. Badges (outlined, 5 px radius) only for counts and categorical tags.
- **Notes:** inline icon plus text on paper; tinted boxes only for blocking errors and the offline banner.
- **Tables:** hairline rows, `surface-2` header, row hover, 44 px+ rows, right-aligned actions.
- **Tabs:** underline tabs for in-page views; no pill segmented controls.
- **Dialogs:** only for decisions that need protected focus (submit exam, approve or deny a request).

## Motion

150–200 ms ease-out on state changes only (hover, selection, save status crossfade). No entrance choreography. Respect reduced motion.

## Browser surfaces (themed, not default)

Text selection, caret, focus ring (2 px ink blue, 2 px offset), scrollbars and `accent-color` all come from the palette.

## Never

Gradient text, glass or blur decoration, eyebrow labels above headings, a coloured bar down one side of a box, hard offset shadows, emoji as icons, decorative concentric shapes, same-size icon cards as page structure, colour as the only signal.
