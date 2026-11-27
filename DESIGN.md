# DESIGN.md: Fairmark visual system

Read this before changing any UI. It is the design contract for every screen; `src/app/globals.css` holds the tokens.
Built with guidance from impeccable, ibelick/ui-skills, Emil Kowalski's skills and ui-ux-pro-max. Craft bar set by the owner's references: Linear, TIB Digital, nk.studio and Treeunfe.

## The look: calm neutrals, one quiet emerald accent (Linear-clean)

- **Reference:** linear.app. Near-black or near-white pages, grey text hierarchy, hairline borders, generous space, thin line art, and almost no colour. Light and dark themes, switched by the sun/moon toggle (`ThemeToggle`) in the homepage nav, the app header and the sign-in page.
- **One accent: emerald,** used sparingly: the logo mark, the one main action per view, links and focus, live states, and the takeaway node of each diagram (outline and icon, never a solid block). Everything else is neutral: nav and secondary buttons are ink or outlined, the answer strip is grey.
- **No gradients behind content.** The homepage product frame is a plain surface with a hairline border, fading out at the bottom, on a very faint grey Vanta dot field. No glass, no glow, no colour washes.
- **Sections share one background** and are separated by hairlines only, never by alternating colour bands.
- **App screens (candidate, examiner, admin):** calm and dense where needed, separated by borders and tone, never shadows. People use them under pressure, so the tool disappears into the task (impeccable "Operate" mode).
- **Explain with pictures first:** the hero shows a 3-step row (`HowSteps`: numbered rules with arrows, thin line drawings, one sentence each) and each homepage section opens with a small `Flow` diagram (neutral boxes and grey arrows, the takeaway outlined in emerald, the thing we never do dashed and struck through) before its interactive demo.
- **Status is a dot plus a word.** Colour goes only on the dot or icon; the label stays ink. Only *Priority* and destructive or error states use coloured text.

## Tokens (see globals.css)

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F7F8F8` | `#08090A` | page canvas |
| `surface` | `#FFFFFF` | `#0F1011` | sheets, tables, inputs, frames |
| `surface-2` | `#F1F2F3` | `#16171A` | toolbars, table heads, wells, selected rows, login panel |
| `foreground` | `#0B0D0E` | `#F7F8F8` | primary text |
| `muted-foreground` | `#5C6168` | `#8A8F98` | secondary text (≥ 5.5:1 on every surface) |
| `border` / `border-strong` | `#E7E8EA` / `#D0D3D6` | `#1C1D20` / `#2A2C30` | hairlines / control outlines |
| `primary` = `brand` | `#047857` | `#34D399` | the accent (white text on light, `#04130D` on dark) |
| `success` / `warning` / `danger` / `flag` / `info` | green / amber / red / teal / blue | lighter tints | status dots, icons, critical text |

## Type

- **Poppins** is the only UI and display face: body and controls 400/500, headings 600 (never bolder). `h1`–`h3` use −0.02em tracking; homepage headlines use `.display` (600, −0.03em, leading 1.08), hero at most 68 px. App base size 14 px; homepage body 15–17 px.
- **Source Serif 4** only for **reading content**: question prompts, exam instructions and incident explanations (`.q-text`, `.prose-read`).
- **IBM Plex Mono** only for identifiers: receipt codes, exam codes, student IDs and timestamps in logs.
- Use `tabular-nums` wherever numbers line up (timers, counts, scores, times). No eyebrows or kickers above headings.

## Layout and spacing

- 4 px grid. Tight inside groups (4–8), generous between sections (32–48 in the app, 96–128 on the homepage). More space above a heading than below it.
- **No card grids as page structure.** Use sections separated by space and hairline rules. Summary numbers live in a single **stat strip** (one bordered row with divided cells).
- **Never nest cards.** A surface inside a surface is a well (`surface-2`) or a rule.
- Max content width 72–76 rem; reading measure 58–72 ch.

## Components

- **Buttons:** rounded rectangles (6 px), no shadows and no pills. 36 px default (40 px `lg`); the homepage main action is 44 px emerald. Secondary actions are ink, outlined or plain underlined links. One primary per view.
- **Status:** `<Status tone="…">Label</Status>` is a dot plus text. Badges (outlined) only for counts and categorical tags.
- **Tables:** hairline rows, `surface-2` header, row hover, 44 px+ rows, right-aligned actions.
- **Tabs:** underline tabs; no pill segmented controls.
- **Progress is an answer strip** (`AnswerStrip`): one cell per question, like a row of answer-sheet boxes. Ink = answered and accepted by the server, grey stripes = kept on the device, outlined = the question on screen, empty = not answered. Never a generic rounded bar.
- **Dialogs and sheets:** dialogs only for decisions that need protected focus (submit, approve or deny, close exam). Side sheets for "act without leaving" panels, such as the monitor's candidate panel.

## Motion

- App: 150–200 ms ease-out on state changes only (hover, selection, save-status crossfade). No entrance choreography.
- Homepage: one CSS-only staggered rise for the hero, Vanta DOTS (transparent, faint grey) behind the product frame, React Bits DecryptedText on the verify code, and interaction-driven demos. Vanta loads after first paint, only at ≥ 768 px, never with reduced motion.
- Theme switch: a circular reveal from the toggle button via the View Transitions API (about 500 ms). Instant with reduced motion or in browsers without the API.
- Always respect `prefers-reduced-motion` and the account's reduced-motion preference (`.reduce-motion`).

## Browser surfaces

Text selection, caret, focus ring (2 px `primary`, 2 px offset), scrollbars and `accent-color` all come from the palette.

## Never

Purple or blue-violet gradients, colour washes or mesh gradients behind content, glow orbs and glowing shadows, pill buttons or pill badges, default card shadows, gradient text, glass, eyebrow labels above headings, a coloured bar down one side of a box, hard offset shadows, emoji as icons, paper or grid textures, colour as the only signal, and invented customers, stats or testimonials (sample data is labelled as sample).
