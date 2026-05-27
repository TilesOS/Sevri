# Handoff: Sevri Pastel/Zine Redesign

## Overview
A visual reskin of the Sevri webapp toward a bold "editorial zine" aesthetic — chunky display type, warm cream paper background with a fine dot grid, hot-pink + cyan + highlighter-yellow accents, and offset hard-shadow "tab" cards. **Information architecture and content remain unchanged from current Sevri** — this is a styling pass, not a feature change.

Three screens are mocked at hi-fi:
- **Dashboard** (`Today`) — welcome + current project + new direction / saved ideas
- **Ideas** — three-up project recommendation board with software/research tracks
- **Project** — active project workspace with the 5-step roadmap, draft pad, and live coach feedback

The sidebar (user chip + page nav + roadmap shortcut + archive) is also redesigned.

---

## About the Design Files
The files in `prototype/` are **design references created in HTML/JSX** — visual mockups demonstrating intended look and behavior. They are **not production code to copy directly**. The task is to **recreate these designs inside the existing Sevri Next.js + Tailwind codebase** using its established components, routing, data layer, and patterns — only the visual layer changes.

Concretely, in the real codebase:
- Update `src/app/globals.css` design tokens to match the new palette/type below.
- Reskin existing components in `src/components/` (sidebar, recommendation card, project workspace, dashboard cards) — keep their props, data shape, and routes the same.
- Do not invent new screens, sections, or data the prototype shows that aren't in the current product. Anything in the mock that doesn't map to existing Sevri data should be implemented as static or removed.

## Fidelity
**High-fidelity.** Exact hex values, type sizes, radii, and shadow offsets are specified below. Treat type and color as canonical. Layout proportions are canonical for desktop ≥ 1200px; smaller breakpoints are not mocked — apply existing responsive patterns.

---

## Design Tokens

### Color
```css
/* Paper neutrals (warmer than current Sevri) */
--paper:       #F5EFE0;   /* app canvas */
--paper-soft:  #ECE4D2;   /* sidebar bg */
--paper-card:  #FBF6E9;   /* card surfaces */

/* Ink */
--ink:         #161412;   /* primary text + all hard borders */
--ink-soft:    #2a2622;   /* secondary text */
--ink-muted:   #6b635a;   /* tertiary / kicker */
--line:        #cdc2af;
--line-strong: #2a2622;

/* Accents */
--pink:    #FF4DA6;
--cyan:    #5BD0D6;
--cyan-2:  #8FE0E5;
--yellow:  #FFD93D;
--green:   #7BB661;       /* success / step done */

/* Background pattern: 1px dots, rgba(22,20,18,0.13), 14px tile, fixed attachment */
```

### Typography
- **Display:** `Archivo Black, sans-serif` — used for h1/h2 hero titles, section numbers, big numerics. Weight 900, letter-spacing −0.02em, line-height 0.92.
- **Body:** `Plus Jakarta Sans` weights 400/500/600/700/800 — UI labels and copy. Default body weight is 500, not 400.
- **Mono / Kicker:** `JetBrains Mono` 700 for editorial kickers, meta strips, badges. Always uppercase, letter-spacing 0.14–0.18em, size 11–12px.
- **Hand:** `Caveat` 700 for the small "~ subtitle ~" notes and footer pull-quotes only. Don't overuse.

Sizes (desktop):
- Hero `display.big`: clamp(56px, 6vw, 96px)
- Section `display.lg`: 56px
- Card title (sans, bold): 22–26px
- Body: 14–17px line-height 1.5–1.6
- Kicker: 11px
- Mono meta: 12.5px

### Spacing & shape
- Radius: cards `4–6px` (sharp, not soft). Buttons are pill-shaped (`9999px`).
- Borders: `2px` or `2.5px solid var(--ink)` on every interactive surface and card. No 1px hairlines.
- Shadows: hard offset shadows only — `3px 3px 0 var(--ink)` for tabs/buttons, `5–6px 6px 0 var(--ink)` for prominent cards. **No blurred drop shadows anywhere.**
- Card hover: translate(−1px,−1px), shadow becomes `4px 4px 0 var(--ink)`.

### Component recipes

**Tab card** (sidebar items, course tiles): paper-card bg, 2px ink border, 4px radius, 3px hard shadow, 12×14 padding. Active state = `--yellow` background.

**Button**: pill, 2px ink border, font-weight 700, 10×18 padding, 3px shadow. Variants: `ink` (default, ink bg/paper text), `pink primary`, `yellow warn`, `paper-card secondary`, `ghost` (no shadow, transparent).

**Kicker** (the most distinctive small text):
```html
<span class="kicker"><span class="star">✦</span>WORKSPACE</span>
```
Font-mono 700, 11px, uppercase, 0.18em tracking. Pink ✦ star prefix.

**Highlighter** behind text: yellow bg, 2px border, 3px shadow, 2px 8px 4px padding. Used inline like `<span class="hl-yellow">back</span>`.

**Coach panel** (dark feedback card): `--ink` bg with 24px subtle white grid overlay, paper-card text, 6px shadow in a pop accent (cyan or pink), kicker color matches the shadow.

---

## Screens

### 1. Sidebar (all routes)
- Width 280px, `--paper-soft` background, 2px right ink border.
- Top: **user tab** — cyan bg with a 6px-offset paper-card "stack" pseudo-element behind it (the layered tab effect from the reference). Avatar circle + name + week counter (mono).
- Hand-label dividers (`~ pages ~`, `~ roadmap ~`, `~ archive ~`) in Caveat with a dashed rule filling the row.
- **Pages** group: today, ideas, project, roadmap, files. Tab card per item; active item gets yellow bg.
- **Roadmap** group: 5 step tiles (Scope, Users, Workflow, Build, Ship) with a 40×40 mono code badge (`01` … `05`). Done = green badge, active = cyan, locked = paper + 0.55 opacity + no shadow.
- **Archive** group: activity, settings — flat (no border, no shadow).

### 2. Dashboard / Today (`route=today`)
The current Sevri Dashboard, reskinned. **No fluff sections.**
- **Mini topbar**: S-mark logo (ink square, yellow S) + AMMAR / DASHBOARD mono labels, right side shows date + week mono.
- **Greeting block**: kicker `✦ WORKSPACE`, then `welcome <yellow-highlight>back</yellow-highlight>.` with a pink period. Decorative pink squiggle SVG placed top-right.
- **Current project card** — uses the `coach` recipe (dark, gridded, pink offset shadow). Kicker "CURRENT PROJECT" in cyan. Display title (the project name). Body "You're on step 3 of 5. Workflow draft is saved." Pink primary button **"open project →"**.
- **Two-up grid below** (1fr 1fr, 22px gap):
  - Left card (paper-card): kicker "START A NEW DIRECTION" → "Run onboarding again" → 4-page note → ghost button "start onboarding →".
  - Right card (cyan): kicker "SAVED IDEAS" → "2 directions saved for later" → "Ambient study-buddy · Climate explainer for your school" → ink button "see ideas →".

### 3. Ideas (`route=ideas`)
- Mini topbar (same pattern, section "IDEAS").
- Meta strip (mono): `✦ 3 OPTIONS`, `2 TRACKS`, `EACH HONESTLY DIFFERENT`. Dashed rule below.
- Title: `three <yellow-hl>actually</yellow-hl> different directions.` (display.big, pink period). Lead paragraph kept verbatim from current Sevri.
- **Track switch**: software / research as two large tab buttons; active gets yellow + a "→ " prefix in label. Right side shows mono hint "KEYBOARD: 1 · 2 · 3 TO PICK".
- **3-up cards** (`grid-template-columns: repeat(3, 1fr); gap: 26px`):
  - Card 1 = `featured` (yellow bg)
  - Card 2 = `cyan` bg
  - Card 3 = paper-card
  - Each: tilted ribbon at top-left ("Quickest to ship" etc.) — pink ribbon for featured, ink ribbon for others. Kicker `✦ OPTION 0N` + difficulty kicker right-aligned. Display-font title (26px). Body paragraph. **2×2 meta grid** with 2px ink border + dashed internal rules: Timeline / Weekly / Finish / Wow. Bottom row: ink "pick this →" + ghost "save".
- Footer hand-quote (Caveat, muted): "— finishability beats theatre, every time —"

Content (titles, descriptions, metric values) is **identical to the current Sevri `RECS` constant** — preserve the data shape.

### 4. Project (`route=project`)
- Mini topbar with section "PROJECT", center display "TRANSIT PLANNER" (project name, dynamic), right shows `WK 04 / 08` and hour count.
- Meta strip: `✦ SOFTWARE`, `8 WEEKS`, `6 HRS / WK`, `NEXT → WORKFLOW`.
- Title block: `~ active project ~` Caveat note in pink, then `neighborhood <yellow-hl>transit planner</yellow-hl>.` display title. One paragraph of body copy.
- **Two-column workspace** (`1.2fr 1fr`, 22px gap, sticky right column):
  - **Left — roadmap step list** (`gap: 12px`). Each step is a `step-row` button:
    - 56×56 numeric badge (ink+yellow when active; green with `✓` when done; paper-card outlined when locked).
    - Mono "step 0N" eyebrow + display-font step title.
    - Right meta: kicker "DONE", or pill "● IN PROGRESS", or kicker "LOCKED".
    - Selected step gets a 3px pink outline at offset 2.
  - **Right — detail card + coach panel**:
    - Detail card (`rec-card` recipe, paper-card bg): kicker `✦ STEP 03`, title "Map the core workflow, end to end", explainer body, `<textarea>` with `var(--font-mono)` 13px content (4-line workflow draft), and a row with primary "save draft" + "ask sevri".
    - Coach panel (dark `coach` recipe with cyan offset shadow): kicker "SEVRI · LIVE FEEDBACK", title "Step 3 is doing two things.", paragraph of feedback, two outlined pill chips "Scope risk" / "Honesty check".
- Footer hand-quote.

---

## Interactions & Behavior
- **Routing**: keep current Next.js routes. `redesign/App.jsx` uses a single `route` state and `localStorage` purely for prototype navigation; do not port that. Sidebar `<Link>`s + `usePathname` for active state.
- **Hover**: every shadowed element shifts `translate(-1px,-1px)` and gains 1px of shadow. Active/pressed reverses to `translate(2px,2px)` with 1px shadow. 120ms ease.
- **Track switch (Ideas)**: existing client-side state — no change.
- **Step selection (Project)**: existing client-side state — no change. Pink focus ring on selected.
- **Focus rings**: `box-shadow: 0 0 0 3px rgba(255,77,166,0.35)` on focus-visible for any interactive element. Replaces the current blue focus ring.
- **No new animations**, transitions, modals, or empty states are introduced by this redesign.

---

## What is **not** part of this redesign (keep current behavior + content)
- All copy on the existing screens (Sevri product copy is preserved)
- Onboarding wizard, marketing hero, billing, sign-in — out of scope for this pass
- Data shape, API calls, route names
- Speaker/coach feedback content
- The 5-step roadmap structure

If you encounter a screen not covered here, apply the new tokens (color, type, border/shadow recipes) but keep its existing layout 1:1.

---

## Files in this handoff

```
prototype/
  index.html      Entry — loads React 18 + Babel standalone, mounts App
  styles.css      Full token + component CSS (canonical source for values above)
  App.jsx         Route switch + main layout grid
  Sidebar.jsx     Sidebar with user tab, pages/roadmap/archive groups
  Today.jsx       Dashboard
  Ideas.jsx       3-up recommendation board
  Project.jsx     Active project workspace
reference/
  aesthetic-reference.png   The mood/aesthetic source the design pulls from
```

Open `prototype/index.html` directly in a browser (no build step required) to see the live mock. Inspect any element to read the canonical CSS — `styles.css` is the source of truth for every token, recipe, and shadow offset referenced above.
