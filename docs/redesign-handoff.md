# Sevri Redesign Hand-off — Roll the Landing System Across the Whole Site

**Purpose.** The public landing page (`src/app/(marketing)/page.tsx`) is the finished, approved reference for Sevri's new look. This doc lets a fresh session apply that exact design language to **everything else** — the authenticated app and any public pages that haven't been reconciled to the landing yet — ideally in one pass with little back-and-forth.

**Golden rule:** when unsure, open the landing page and copy how it does it. The landing is the single source of truth. You have creative latitude on layout per screen, but **never** leave the palette / token / motion norms below.

> **Authenticated-product exception (approved July 2026):** inside `.product-ui`, brand blue—not coral—is the semantic primary for routine actions, focus, progress, active navigation, and selected states. The landing and other public pages keep the coral primary. Navy remains the dark “moment” color, teal means completion/software, and coral is reserved for a few warm attention accents.

---

## 0. Scope

**Redesign (visual only):**
- **The app** (`src/app/(app)/**`): dashboard, onboarding, recommendations, project workspace (`project/[id]` + `scope`, `research-lens`, `pitch-kit`, `steps/[step]`), calendar, portfolio (+`[projectId]`), settings (+`integrations`, `billing`), billing, success, cancel.
- **The app shell**: `src/components/shared/app-header-client.tsx` (sidebar + header) and `src/components/project/project-sidebar-navigation.tsx`.
- **App component library**: everything under `src/components/{project,onboarding,recommendations,calendar,settings,billing,portfolio,reviewer,shared}/`.
- **The neo-brutalist recipe classes** in `src/app/globals.css` (the `@layer components` block: `.tab`, `.rec-card`, `.coach`, `.step-row`, `.course-tile`, `.user-tab`, `.pill`, `.meta-strip`, `.solid-thin`, `.dashed-line`, `.hand-label`, `.handnote`, `.star`, `.hl-yellow`, `.contrast-grid`, `.app-sidebar-shell`, `.muted-toggle-surface*`). These still drive the app's old look.
- **Reconcile the remaining public pages** to landing conventions: `terms`, `privacy`, `suggestions` still use old inline styles (`.kicker`, `.star`, inline `borderTop`, hard shadows). `pricing`, `support`, and the auth pages are already close — nudge them to match the latest landing conventions (word-reveal headings, borderless dimmed cards).

**Do NOT touch:** business logic, data fetching, mutations, RLS/policies, API routes, auth guards, Stripe/Supabase/OpenAI wiring, env, Suspense/server-client boundaries. This is a **skin + motion** pass. Keep every component's props/exports and the token *names* stable.

---

## 1. Design language (north star)

Premium warm-editorial. Warm-cream canvas on public pages and a pale blue-grey workspace canvas in the authenticated product, deep-navy "moments" for emphasis (hero, CTAs, the Pro plan, empty states), a soft teal/coral **aurora** as the signature texture, brand blue for product actions, coral for public conversion and rare warm accents, generous whitespace, **noticeably less text than the old app**, and cohesive scroll-linked motion.

Feel targets: fromanother.love (palette), midu.design (motion + typography), raycast/xtract (polish).

---

## 2. Tokens & conventions (already built — just use them)

All defined in `src/app/globals.css` `:root` and wired into `tailwind.config.ts`. **Use Tailwind color utilities**, not raw hex.

### Palette

| Role | Token / utility | Value |
|---|---|---|
| Page canvas (light) | `bg-canvas` | `#F4EBD1` warm cream |
| Card surface (light) | `bg-paper` | `#FBF4E1` dimmed cream |
| Subtle surface | `bg-surface` / `-strong` | `#F0E7CF` / `#E7DDC7` |
| Teal-tinted panel | `bg-surface-mint` | `#E9F2EA` |
| Coral-tinted panel | `bg-primary-soft` | `rgba(255,107,76,0.10)` |
| Ink text | `text-ink` / `-soft` / `-muted` | `#0B1526` / `#33405A` / `#6B7488` |
| Hairline | `border-line` / `-strong` | `#E7DDC7` / `#D6C9AC` |
| Primary action (coral) | `bg-primary` / `text-coral` | `#FF6B4C` (hover `#F2542D`) |
| Secondary accent (teal) | `text-teal` / `-deep` | `#5BD0D6` / `#46D3C0` |
| Tertiary accent | `text-pale-blue` | `#D2E4F4` |
| Dark "moment" | `bg-navy` / `bg-navy-deep` | `#0B1E4D` / `#051236` |
| Text on dark | `text-cream` (+`/70`,`/60`,`/45`…) | `#FFFDE2` |

### Rules
- **Opacity works** on these colors (`text-cream/70`, `bg-cream/[0.04]`, `border-line/60`) because each color is a `rgb(var(--x-rgb) / <alpha-value>)`. **When you add a new palette color, add BOTH `--x` (hex) and `--x-rgb` (space-separated channels), then map Tailwind to the `rgb(var(--x-rgb) / <alpha-value>)` form.** A bare `var(--x)` color silently drops opacity modifiers.
- **Radii:** `rounded-2xl` cards, `rounded-3xl` feature/hero panels, `rounded-full` buttons/pills/chips.
- **Shadows:** only `shadow-soft` / `shadow-lifted` (soft, diffuse). **No offset "brutalist" shadows** (`Npx Npx 0 var(--ink)`), no `border-2 border-ink`, no `rotate()` on cards.
- **Borders:** light cards are **borderless** — separate them with `bg` contrast + `shadow-soft`. Dark aurora cards use `ring-1 ring-inset ring-white/[0.07]`. Navy panels may use `border-contrast-line`.
- **Scrollbars** are hidden globally (already set). Keep it.
- **Fonts (already loaded, use the utility):** `font-sans` = Schibsted Grotesk (body), `font-display` = Archivo (headings), `font-serif` = Instrument Serif (eyebrows/labels/wordmark, usually italic), `font-mono` = JetBrains Mono (tiny uppercase kickers via `.editorial-kicker`). **Do not use `font-hand` (Caveat)** anywhere new — remove it as you touch app screens.

---

## 3. Reusable components & patterns (don't rebuild)

**Primitives** (`src/components/ui/`):
- `Button` — variants `primary` (coral), `secondary` (navy), `outline`, `ghost`, `contrast` (cream-on-dark), `danger`. Already has tactile press + hover-lift. Use it everywhere.
- `Card` — tones `default`/`subtle`/`butter` (borderless light), `blush`/`primary` (coral tint), `contrast` (navy). Pass `elevation="soft"`.
- `Section` — `eyebrow`/`title`/`description` props auto-wrap in a scroll `Reveal`. Tones `default` / `contrast` (navy) / `blush` / `butter`.
- `Container`, `Input`, `FormField`, `Alert`, `Badge`, `SegmentedControl`, `ProgressBar`, `StatCard` — restyle these primitives first; the app inherits them.

**Motion** (`src/components/marketing/` + `ui/reveal.tsx`):
- `Reveal` — fade+rise on scroll (0.7s, triggers ~12% before center). Default entrance for blocks.
- `WordReveal` — word-by-word heading reveal. Use for a page's *main* heading only.
- `Parallax`, `HeroScrollFade`, `FadeIn` — scroll-linked depth for hero/feature areas.
- `SmoothScroll` (Lenis) — currently mounted in the marketing layout. **Consider NOT adding it to the app** (dense/utility screens feel snappier with native scroll); if you do, gate it and test.
- `AuroraBackground` + `aurora-shader` — the navy WebGL aurora with CSS fallback. Reserve for hero-class surfaces and navy CTAs/empty-states. `.aurora-fallback` (CSS-only) is the cheap version for smaller navy panels.
- `ScopeMarquee` — infinite floating-card marquee pattern (aurora-gradient cards on uniform navy).
- `FaqAccordion` — animated single-open accordion.
- `ExpandableCard` — **the modal detail pattern**: a tile that opens a centered modal (blurred backdrop, image-placeholder left, text right, midu box styling). Reuse this pattern anywhere a card should "expand to details."
- `MarketingNavClient` — the transparent floating nav + full-screen menu takeover (reference for the app top bar if you want continuity).

---

## 4. Signature moves to sprinkle (the "landing DNA")

Use these to make app screens feel like the landing without copying it literally:
1. **Serif-italic eyebrow** (`font-serif italic text-coral`/`text-teal-deep`) or **mono kicker** (`.editorial-kicker`) above a big **`font-display` heading**.
2. **Navy aurora "moment"** blocks for emphasis — page CTA, the Pro/upgrade card, empty states, the "coach" panel. Use `bg-navy` + `.aurora-fallback` overlay + cream text (see landing final-CTA and pricing Pro card).
3. **Tinted feature cards** to differentiate two-of-a-kind content: teal (`bg-surface-mint`) vs coral (`bg-primary-soft`), each with a status chip + `→` affordance (see landing "Two tracks").
4. **Borderless dimmed cards** with `shadow-soft`, hover-lift (`hover:-translate-y-1.5 hover:shadow-lifted`).
5. **Modal detail** (`ExpandableCard` pattern) instead of inline expand for "learn more."
6. **Primary depends on surface.** Coral remains primary on marketing/public pages; brand blue is primary inside `.product-ui`. Teal means completion/software, navy means dark moments/research, and coral becomes a rare warm accent in authenticated screens. Amber (`--yellow` legacy = `#F4B740`) only if you truly need another semantic accent.
7. **Restraint:** aurora and word-reveal are seasoning. One hero moment per screen, not five.

---

## 5. Retire the neo-brutalist recipe classes (biggest single lever)

Rewrite the `@layer components` block in `globals.css`. These classes are used across app screens, so fixing them re-skins most of the app at once. Target mapping:

| Old class | Now | New treatment |
|---|---|---|
| `.tab` (sidebar nav) | soft nav pill | `bg-transparent` → `hover:bg-surface`; active = `bg-primary-soft text-coral` or a subtle coral left-accent; **remove** the `border-2 border-ink` + `3px 3px 0` offset shadow |
| `.tab.is-active` | coral active | drop the yellow fill; use coral-soft bg + coral text/indicator |
| `.user-tab` | soft profile chip | `bg-surface` rounded-2xl, no offset shadow |
| `.course-tile` / `.step-row` | soft list rows | `bg-paper` rounded-xl `shadow-soft`, active = `bg-surface-mint`/coral accent, `.locked` = reduced opacity; remove offset shadow + hard border |
| `.rec-card` | premium option card | borderless `bg-paper` `shadow-soft` rounded-2xl; featured = navy aurora moment or coral-tinted; ribbon → small chip |
| `.coach` | navy aurora panel | `bg-navy` + `.aurora-fallback` overlay + cream text; drop the grid overlay or keep very faint |
| `.pill` | subtle pill | `bg-surface` rounded-full, `border-line` optional, mono label |
| `.meta-strip` | quiet meta row | mono `text-ink-muted`, keep |
| `.solid-thin` / `.dashed-line` | hairlines | `border-line` 1px; drop the 2px ink |
| `.hl-yellow` | already a coral highlighter | keep |
| `.hand-label` / `.handnote` | remove | delete; replace any usage with `.editorial-kicker` or serif label |
| `.star` | coral accent glyph | keep (already coral) or replace with a small dot |
| `.contrast-grid` | optional | drop or keep at very low opacity on navy heroes |
| `.app-sidebar-shell` | clean sidebar | `bg-canvas`, remove the `2px solid ink` right border → `border-line`; add subtle depth |
| `.muted-toggle-surface*` | soft toggle | surface bg, coral-soft active |

Also: `.display`, `.kicker`, `.editorial-kicker`, `.font-display`, `.font-serif` are already good — leave them.

---

## 6. Execution order (do it in this sequence for a clean one-shot)

1. **Primitives + recipe classes** — restyle `ui/` primitives (Button/Card/Section already done; do Input/FormField/Badge/SegmentedControl/ProgressBar/StatCard/Alert) and rewrite the `globals.css` recipe classes (§5). *This alone re-skins ~60% of the app.*
2. **App shell** — `app-header-client.tsx` sidebar + top bar, and `project-sidebar-navigation.tsx`. Serif wordmark, soft nav pills, coral active, clean header. Keep all logic.
3. **Core loop (hero surfaces — most polish):** Dashboard → Recommendations → Project workspace (overview, roadmap/steps, scope, research-lens, pitch-kit).
4. **Onboarding** wizard.
5. **Settings / integrations / billing** (billing reuses the pricing Pro navy card).
6. **Calendar, Portfolio (+detail), Reviewer** surfaces.
7. **Success / cancel** + reconcile **public utility pages** (terms/privacy/suggestions) and nudge pricing/support/auth to the newest conventions.
8. **Polish pass:** consistency, contrast/a11y, reduced-motion, and grep for leftovers (§10).

---

## 7. Per-area direction (layout is yours; constraints are not)

**Dashboard** — Serif eyebrow + `font-display` welcome heading (short). Project/track entry points as borderless dimmed cards with hover-lift; primary action coral. One navy aurora "moment" (e.g., "start a new project" CTA or the empty state). Cut copy hard.

**Recommendations** (hero surface — make it shine) — the 3-option board. Treat as tinted/aurora feature cards, one accent each (e.g., quickest→teal, most-ambitious→coral, balanced→pale-blue). Ribbons → chips. "See details" opens the `ExpandableCard` modal (image-left/text-right). Comparison meta as clean key/value rows, not the `.rec-card .meta-grid` boxes.

**Project workspace** — Overview: serif eyebrow + display title + soft cards. Roadmap/steps: retire `.step-row`/`.course-tile` → soft rows with coral "active", muted "locked". The coach/guidance panel → **navy aurora moment**. Progress tracker → premium `ProgressBar` + soft stats. Scope / research-lens / pitch-kit: soft cards, mono kickers, tinted accents; keep dense info readable (this is a working surface — favor clarity over drama, fewer aurora moments).

**Onboarding** — Premium multi-step. Big question per step (display heading), minimal helper text, `ProgressBar`, coral primary "Next". Optional slim navy aurora side rail like the auth split. Keep the wizard's state logic intact.

**Settings / integrations / billing** — Clean forms (Input/FormField already themed). Integration cards borderless with a small status chip. Billing plan card = the **navy aurora Pro card** from pricing; "Manage/Upgrade" coral.

**Calendar** — Clean month/week grid, hairline `border-line`, today = coral marker, events as soft chips. Restrained motion.

**Portfolio (listing + detail)** — Gallery of borderless cards with hover-lift and an image-forward layout; detail page gets a small hero header (serif eyebrow + display title, maybe a navy aurora band) then soft content cards.

**Reviewer surfaces** — Reuse the modal + card patterns (`reviewer-invite-modal` → the new modal styling; panels → soft cards).

**Success / cancel** — Small centered cards (success = navy aurora moment + coral CTA; cancel = calm cream card).

**Public utility pages (terms/privacy/suggestions)** — Header treatment identical to `support`/`pricing`: `font-serif italic` coral eyebrow + `font-display` heading + short subline; body prose in `text-ink-soft` with comfortable measure; remove `.kicker`+`.star` combos and inline `borderTop`/offset styles. Long legal text stays — just re-skin the chrome.

---

## 8. Motion policy for the app (lighter than marketing)

- **Reveal on scroll:** yes, but keep it subtle on dense/utility screens.
- **Aurora/WebGL:** reserve for hero surfaces, navy CTAs, and empty states — not on every card (GPU + distraction). Use the cheap `.aurora-fallback` for small navy panels.
- **WordReveal:** page main heading only.
- **Lenis:** probably skip inside the app (keep native scroll for dashboards/forms). If added, gate + test with the fixed elements.
- Keep interactions tactile (button press, hover-lift, modal spring). Respect `prefers-reduced-motion` (helpers already do).

---

## 9. Closing the sign-in seam

After the app shell + dashboard are done, the visible style jump at sign-in disappears. Sanity-check by walking sign-in → dashboard and confirming the wordmark, nav, buttons, and surfaces read identically.

---

## 10. Verification & guardrails

**After each area:** `npm run typecheck` and `npm run lint` (both must stay clean). A full `npm run build` fails locally on `/api/billing/*` due to missing `STRIPE_*` env — that's pre-existing and unrelated; ignore it.

**Local visual check.** Marketing/auth render with a throwaway `.env.local` holding dummy `NEXT_PUBLIC_*` (URL-shaped + non-empty), then `npm run dev` + Playwright screenshots. **Caveat:** `(app)` routes call `getRequiredUser()` and redirect to `/sign-in` without a real session, so dummy env **won't** render authed screens. To view app screens you need Tyler's real env + a logged-in session (ask him to run dev with his env and log in, then drive Playwright), or rely on careful component-level work + the proven primitives and have Tyler review. Always **delete the temp `.env.local`** and any screenshots when done.

**Leftover-brutalist grep (should return nothing in redesigned files):**
```
rg "border-2 border-ink|0 var\(--ink\)|rotate\(-?\d|var\(--font-hand\)|hand-label|handnote|3px 3px 0|6px 6px 0" src
```

**Guardrails:** visual only; keep token names + component APIs; don't cross server/client boundaries; don't touch logic/data/auth/billing; improve a11y (labels, focus rings, contrast AA on every text/bg pair), never regress it.

---

## 11. Copy-paste reference snippets (from the landing)

**Navy aurora "moment":**
```tsx
<div className="relative overflow-hidden rounded-3xl bg-navy px-8 py-16 text-center text-cream">
  <div className="aurora-fallback pointer-events-none absolute inset-0 opacity-40" />
  <div className="relative z-10 mx-auto max-w-2xl">
    <h2 className="font-display text-4xl leading-tight sm:text-5xl">Heading</h2>
    <p className="mx-auto mt-4 max-w-lg text-lg leading-8 text-cream/75">Sub.</p>
    <Button href="/x" size="lg" className="mt-8 px-7">Action</Button>
  </div>
</div>
```

**Borderless dimmed card + hover-lift:**
```tsx
<Card padding="lg" elevation="soft" className="transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lifted">…</Card>
```

**Tinted feature card (teal variant):**
```tsx
<div className="rounded-3xl bg-surface-mint p-8 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lifted">
  <span className="inline-flex items-center gap-2 rounded-full bg-teal-deep/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-teal-deep">
    <span className="h-1.5 w-1.5 rounded-full bg-teal-deep" /> Label
  </span>
  <h3 className="mt-6 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">Heading</h3>
  {/* … */}
</div>
```

**Section header with word-reveal (main headings):**
```tsx
<Section>
  <div className="max-w-3xl">
    <Reveal><p className="editorial-kicker mb-3">Eyebrow</p></Reveal>
    <WordReveal text="Your heading here." className="font-display text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl" />
  </div>
  {/* content */}
</Section>
```

---

### One-line brief for the fresh chat
> Read `docs/redesign-handoff.md`. Apply Sevri's landing-page design system (palette/tokens/fonts/motion in that doc) across the authenticated app + remaining public pages, in the execution order in §6, following §5 (retire brutalist recipe classes) and §7 (per-area direction). Visual only — keep all logic and component APIs. Verify with typecheck + lint per area; note that authed screens need real env to view. Landing page is the source of truth.
