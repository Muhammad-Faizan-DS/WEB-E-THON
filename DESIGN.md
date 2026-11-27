# DESIGN.md: Fairmark visual system

Read this before changing any UI. It is the design contract for every screen; `src/app/globals.css` holds the tokens.
Built with guidance from impeccable, ibelick/ui-skills, Emil Kowalski's skills and ui-ux-pro-max. Craft bar set by the owner's references: Linear, TIB Digital, nk.studio and Treeunfe.

## The look: warm paper and roast, one vivid orange

- **Palette (owner's choice):** Vivid Orange `#FF5C00`, French Roast `#3E2407`, Soft Brown `#796758`, Orangey Greige `#F7F0E8`. Light and dark themes, switched by the sun/moon toggle (`ThemeToggle`) in the homepage nav, the app header and the sign-in page.
- **Two oranges, for contrast:** vivid orange (`brand`) is a **fill** only (main buttons, answered cells, takeaway nodes, the logo) with roast text on it. Small orange text, links and focus use `primary` (burnt `#B8430A` on light, `#FF7A2E` on dark).
- **The gradient plate (`.mesh-plate`)** is the one brand moment: layered radial gradients blended `in oklch` (orange, peach, roast) plus a fine SVG grain overlay that removes banding. It sits behind the homepage product frame, in the closing band and on the login brand panel. Never put body text directly on it; text goes on a solid or glass surface above it.
- **Glass only over the plate:** the homepage product frame and the login card are frosted (`bg-surface/55–70`, `backdrop-blur-2xl`, a thin light edge). An element with backdrop blur must not sit inside an ancestor that animates opacity or has a filter or mask (that hides the backdrop). No glass on app screens.
- **App screens (candidate, examiner, admin):** calm and dense where needed. Warm neutral surfaces separated by hairline borders and tone, never by shadows. People use them under pressure, so the tool disappears into the task (impeccable "Operate" mode).
- **Explain with pictures first:** the hero shows a 3-step pictogram row (`HowSteps`: build → take → results) and each homepage section opens with a small `Flow` diagram (boxes and arrows, the takeaway filled orange, the thing we never do dashed and struck through) before its interactive demo.
- **Status is a dot plus a word.** Colour goes only on the dot or icon; the label stays ink. Only *Priority* and destructive or error states use coloured text.

## Tokens (see globals.css)

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F7F0E8` | `#170E06` | page canvas |
| `surface` | `#FFFCF8` | `#22150A` | sheets, tables, inputs, homepage bands |
| `surface-2` | `#F3EBE1` | `#2E1D0D` | toolbars, table heads, wells, selected rows |
| `foreground` | `#3E2407` | `#F7F0E8` | primary text |
| `muted-foreground` | `#796758` | `#B5A291` | secondary text (≥ 4.5:1 on every surface) |
| `border` / `border-strong` | `#E6D9CA` / `#D3C2AF` | `#3E2407` / `#5A3A18` | hairlines / control outlines |
| `primary` | `#B8430A` | `#FF7A2E` | links, focus, selection, primary app buttons (white text on light, `#170E06` on dark) |
| `brand` | `#FF5C00` | `#FF5C00` | fills only, with `brand-foreground` (roast) text |
| `success` / `warning` / `danger` / `flag` / `info` | green / amber / red / teal / blue | lighter tints | status dots, icons, critical text |
| `--plate-*`, `--grain-*` | warm greige plate | deep roast plate | `.mesh-plate` only |

## Type

- **Poppins** is the only UI and display face: body and controls 400/500, headings 600/700. `h1`–`h3` use −0.02em tracking; homepage headlines use `.display` (700, −0.035em, leading 1.04). App base size 14 px; homepage body 15–19 px.
- **Source Serif 4** only for **reading content**: question prompts, exam instructions and incident explanations (`.q-text`, `.prose-read`).
- **IBM Plex Mono** only for identifiers: receipt codes, exam codes, student IDs and timestamps in logs.
- Use `tabular-nums` wherever numbers line up (timers, counts, scores, times). No eyebrows or kickers above headings.

## Layout and spacing

- 4 px grid. Tight inside groups (4–8), generous between sections (32–48 in the app, 96–128 on the homepage). More space above a heading than below it.
- **No card grids as page structure.** Use sections separated by space and hairline rules. Summary numbers live in a single **stat strip** (one bordered row with divided cells).
- **Never nest cards.** A surface inside a surface is a well (`surface-2`) or a rule.
- Max content width 72–76 rem; reading measure 58–72 ch.

## Components

- **Buttons:** rounded rectangles everywhere (6 px in the app, 8 px on the homepage), no shadows and no pills. 36 px default (40 px `lg`); homepage main actions 48 px, vivid orange with roast text. One primary per view.
- **Status:** `<Status tone="…">Label</Status>` is a dot plus text. Badges (outlined) only for counts and categorical tags.
- **Tables:** hairline rows, `surface-2` header, row hover, 44 px+ rows, right-aligned actions.
- **Tabs:** underline tabs; no pill segmented controls.
- **Progress is an answer strip** (`AnswerStrip`): one cell per question, like a row of answer-sheet boxes. Orange = answered and accepted by the server, soft-brown stripes = kept on the device, outlined = the question on screen, empty = not answered. Never a generic rounded bar.
- **Dialogs and sheets:** dialogs only for decisions that need protected focus (submit, approve or deny, close exam). Side sheets for "act without leaving" panels, such as the monitor's candidate panel.

## Motion

- App: 150–200 ms ease-out on state changes only (hover, selection, save-status crossfade). No entrance choreography.
- Homepage: one CSS-only staggered rise for the hero, dashed step arrows that draw in, Vanta DOTS (transparent, theme-coloured) on the gradient plate, React Bits DecryptedText on the verify code, and interaction-driven demos. Vanta loads after first paint, only at ≥ 768 px, never with reduced motion.
- Theme switch: a circular reveal from the toggle button via the View Transitions API (about 500 ms). Instant with reduced motion or in browsers without the API.
- Always respect `prefers-reduced-motion` and the account's reduced-motion preference (`.reduce-motion`).

## Browser surfaces

Text selection, caret, focus ring (2 px `primary`, 2 px offset), scrollbars and `accent-color` all come from the palette.

## Never

Purple or blue-violet gradients, glow orbs and glowing shadows, pill buttons or pill badges, default card shadows, gradient text, glass on app screens, text set directly on the gradient plate, eyebrow labels above headings, a coloured bar down one side of a box, hard offset shadows, emoji as icons, paper or grid textures, colour as the only signal, and invented customers, stats or testimonials (sample data is labelled as sample).
