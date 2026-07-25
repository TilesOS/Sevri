# Sevri — Design, UX, and Functional Audit

**Date:** July 24, 2026
**Environment:** Production (`https://sevri.co`), authenticated Pro account (Tyler, GitHub OAuth sign-in), Chrome.
**Viewports tested:** 1440×900, 1024×768, 390×844, 720×450 (200%-zoom equivalent). Keyboard-only passes on public and authenticated flows.
**Method:** Live black-box inspection of every discoverable surface; safe, reversible interaction testing; read-only inspection of the repository for evidence labeling only (no code changed). Quota-consuming, payment, OAuth, invitation, publishing, and destructive actions were intentionally not executed.

---

## 1. Executive summary

**Overall assessment.** Sevri's visual foundation is unusually strong for a pre-launch product: the marketing site is editorial and confident, the app shell is calm and legible, the step workspace is a genuinely good piece of coaching UX, and the privacy/terms posture is thoughtful and age-appropriate. But the product currently breaks its own core promise at the two moments that matter most: **the portfolio detail page crashes on every entry** (the "turn work into proof" journey is completely blocked), and **a large share of the AI/template-generated content that represents the student's work — elevator pitches, résumé bullets, scope statements, portfolio summaries, and even stored project titles — is grammatically broken, truncated mid-sentence, or contaminated with artifacts**. A student who trusted these outputs would be embarrassed by them, which is fatal for a product whose pitch is credibility.

**Strongest aspects.**
- Marketing design quality: distinctive, calm, editorial; clear two-track story; honest FAQ and pricing; strong privacy policy and terms written for a 13+ audience.
- The step workspace: objective → checklist → "current task" → done-when criteria → submission → reviewer feedback is a coherent, motivating loop. Checklist toggling persists correctly and optimistic UI works.
- Focus mode is simple and works (start, pause, end-early routes back to the submission panel).
- Safety rails exist where tested: calendar work-block validation ("Choose a valid date."), reviewer invite validation, profile-name validation, plan copy in the invite modal ("Reviewers... won't be billed. Invitations expire after 14 days.").
- Visible focus styles (2px orange outline) and largely sensible semantics (real checkboxes, labeled dialogs, aria-expanded on accordions).

**The five most important problems.**
1. **FUN-001 (P1):** `/portfolio/[projectId]` throws a server-side exception (digest `3277953323`) for every entry. The entire portfolio → reflection → evidence → export → publish journey is unreachable.
2. **DES-024 + FUN-014 (P1):** Systemic template-stitched and truncated generated content — nonsense résumé bullets ("Built X to address a polished, single-demo web app…"), sentences ending mid-word ("…identify underexploit"), internal profile language leaking to users ("Sevri's target outcome", "The profile is optimized for…"), and a CJK mojibake character ("alias別"). This is the content the product exists to produce.
3. **FUN-005 (P1):** Progress is computed differently on different surfaces: the same project reads 72% on the dashboard/project page and 60% in the portfolio; a project with zero completed steps shows 40%. Students cannot trust the numbers the product uses to motivate them.
4. **FUN-004 (P1):** Billing shows "Sevri Pro is active" alongside "Current period ends: 4/11/2026" — a date more than three months in the past. Either subscription sync is broken or the display is wrong; either way it undermines billing trust, and the presence of a "Sync billing now" escape hatch suggests known fragility.
5. **FUN-002 (P1):** On `/recommendations`, switching Software ↔ Research updates the URL, header copy, badges, and the feedback widget — but the three idea cards keep showing the previous track until a hard reload. The comparison board, the core artifact of the ideas surface, silently shows the wrong track's content.

**Is the core promise fulfilled?** Partially. Choose a direction → compare three ideas → generate a roadmap → execute steps: this spine works and feels good. Turn finished work into proof (portfolio, résumé bullets, public page): currently broken by FUN-001 and by generated-content quality. The "coaching" half is real; the "portfolio" half is not yet.

**Release readiness: Not production-ready.** Beta-ready with caveats *only after* FUN-001 (portfolio crash), FUN-004 (billing display), and the generated-content truncation issues are fixed. The remaining P1/P2 items are compatible with a monitored beta.

**Confidence.** Design conclusions: **high** — every major surface was visually inspected at three widths with keyboard and zoom passes. Functional conclusions: **moderate-high** for everything exercised directly (checklists, wizard, calendar form, invite modal, track switching, portfolio crash — all reproduced at least twice); **low-moderate** for areas gated by safety constraints (payments, OAuth, publishing, reviewer acceptance, generation), which are reported as risks, not findings.

---

## 2. Coverage and limitations

| Area / journey | Routes & surfaces inspected | Viewports | Status | Notes / safety limits |
|---|---|---|---|---|
| Marketing site | `/`, `/pricing`, `/support`, `/suggestions`, `/privacy`, `/terms`, full-screen menu, how-it-works modals, FAQ accordions | 1440, 390, 720 | **Pass w/ findings** | All links followed; modals and accordions exercised |
| Auth | `/sign-in`, `/sign-up` (validation, invalid credentials, checkbox attestation) | 1440 | **Partial** | Real sign-up/sign-out not executed (session preservation); OAuth buttons not clicked |
| App shell / navigation | Sidebar, account menu, breadcrumbs, mobile drawer (open/close/backdrop/Escape), deep links, refresh | 1440, 1024, 390 | **Pass w/ findings** | Sidebar resize handle observed, drag-resize not exercised |
| Dashboard | `/dashboard`, hero card, momentum panel, project list | 1440, 390 | **Pass w/ findings** | |
| Onboarding | `/onboarding`, both tracks, steps 1–3, back/forward, prefill, whitespace validation | 1440 | **Partial** | Final submit not executed (would consume a generation / overwrite intake) |
| Recommendations | `/recommendations`, `?track=research`, detail disclosures, learning-loop form | 1440 | **Partial** | "Refresh board" and "Choose this project" not executed (quota / creates project) |
| Project & roadmap | `/project/[id]` (software), `/scope`, `/research-lens`, `/pitch-kit`, sidebar step nav | 1440 | **Pass w/ findings** | Research-track project pages sampled via portfolio/calendar data only |
| Step workspace | `/project/[id]/steps/4`: checklist toggle + reload persistence + restore, step detail disclosure, submission panel open/close, focus block start/pause/end | 1440, 390, 720 | **Pass w/ findings** | "Mark step complete", "Refresh guidance", "Get evaluation" not executed (state change / AI quota) |
| Focus mode | `/projects/[id]/focus?milestone=…` | 1440 | **Pass** | Timer started and ended early; state restored |
| Calendar | `/calendar`: month nav, Today, filters, work-block form validation, agenda view | 1440, 390 | **Pass w/ findings** | .ics download and Google connect not executed; no work block actually created |
| GitHub integration | Disconnected states on project page + `/settings/integrations` | 1440 | **Partial** | OAuth connect not executed; connected-state UI, repo linking, commit display **Not tested** |
| Reviewers | Invite modal (validation, invalid email, Escape), reviewer route access boundary (`/reviewer` redirects student to dashboard) | 1440 | **Partial** | No invitation sent; acceptance page and reviewer view **Not tested** (no safe test invite exists) |
| Portfolio | `/portfolio` listing, filters, stats; `/portfolio/[id]` ×2 entries | 1440 | **Fail** | Detail page crashes (FUN-001); reflection/evidence/exports/publishing **Blocked** |
| Public portfolio pages | `/p/[nonexistent]` only | 1440 | **Blocked** | No published page exists / discoverable; publishing not executed by policy |
| Settings & billing | `/settings` (profile save round-trip incl. validation + restore), `/settings/integrations`, `/settings/billing` | 1440 | **Pass w/ findings** | Stripe checkout/portal and "Sync billing now" not executed |
| Error handling | Invalid project id, `/p/*` 404, rate-limit degradation on step page, console/network sweep | 1440 | **Pass w/ findings** | Console clean on dashboard; no failed requests observed pre-rate-limit |

**Actions intentionally not executed (safety constraints):** final onboarding submission; board regeneration; project selection; "Mark step complete"; "Refresh guidance"; "Get evaluation"; sending any reviewer invitation; connecting/disconnecting GitHub or Google Calendar (OAuth); `.ics` download; any Stripe checkout, billing portal, or manual billing sync; publishing/unpublishing a portfolio page; sign-out; any deletion.

---

## 3. Design scorecard (1–10)

| Category | Score | Justification |
|---|---|---|
| Value proposition & conversion | 8 | "Build a project you'll actually finish" is specific and differentiated; two tracks and finishability are explained convincingly; honest FAQ. Held back by the hero's slow fade-in, the "VISUAL PLACEHOLDER" modal, and stale CTAs for signed-in users. |
| Information architecture | 6 | Workspace nav is small and learnable; project sub-nav (Overview / Scope / Lens / Presentation / Steps) is sound. But labels disagree with routes and breadcrumbs (Pitch kit vs Presentation, Scope vs Scope & Guardrails, "Research Lens" on software projects, "Explore a project" → onboarding). |
| Visual hierarchy & craft | 8 | Consistently high polish: type scale, cards, editorial serif accents, restrained color. Marquee number ordering and event-chip overflow in calendar are the main lapses. |
| Consistency & design system | 6 | Components are visually consistent, but terminology, progress models, route naming (`/project` vs `/projects`), and empty-state patterns diverge across surfaces. |
| Responsive design | 6 | Layouts reflow well at 1024/390/720 (calendar becomes an agenda; drawer nav is correct). Scroll-reveal animation leaves blank regions during normal mobile scrolling; fixed submit bar consumes too much of small viewports; step-nav strip bleeds off-screen with no affordance. |
| Accessibility | 6 | Real strengths: visible focus ring, labeled modals with Escape + focus return, native checkboxes, aria-expanded, `prefers-reduced-motion` rules exist. Gaps: no skip link, focus not moved into how-it-works dialog, marquee duplicates unhidden, account menu ignores Escape, browser-native-only error surfacing, near-invisible 404 content. |
| Content & terminology | 4 | Human-written copy is excellent. Generated user-facing content (pitch kit, scope, portfolio summaries, some titles) is frequently broken — the single biggest quality gap in the product. |
| Authenticated workflow clarity | 7 | Dashboard hero card, "Go to current step," current-task highlighting, and done-when criteria create real clarity. Progress semantics (40% baseline, compressed step range) and the portfolio dead-end undermine it. |
| Trust, privacy & age appropriateness | 7 | 13+ attestation at sign-up, 16+ publishing attestation, substantive privacy policy naming processors, encrypted GitHub tokens, reviewer expiry copy. Billing period display and raw error strings cost points. |
| **Overall design quality** | **7** | A distinctive, credible design system undermined mainly by generated-content quality and cross-surface consistency, not by visual craft. |

## 4. Functional scorecard (1–10)

| Category | Score | Notes |
|---|---|---|
| Authentication | 6 | Sign-in/up work, validation exists, invalid creds handled. No password reset path; no authed-redirect; missing autocomplete attrs. Sign-out untested. |
| Onboarding | 7 | Prefill, track switching, step progression, back-nav, live summary all work. Whitespace passes required-field validation; wizard state lost on reload. Final submit untested. |
| Recommendations | 5 | Existing boards render rich content; detail disclosures work. Track toggle shows stale cards (FUN-002); stored content truncated; generation untested. |
| Project & roadmap | 7 | Overview, scope, lens, pitch-kit, step navigation, deep links, refresh all solid. Content quality issues are counted elsewhere. |
| Step execution & progress | 8 | Checklist toggle + persistence + restore verified; current-task advance; submission panel; focus block loop. Rate-limit degradation and complete/reopen untested keep it from 9. |
| Calendar | 6 | Month nav, Today, filters, selected-day panel, validation all work. Wrong default month; chip overflow; export/Google untested. |
| GitHub integration | **Insufficient evidence** | Only disconnected states inspected; connect flow not executed by policy. |
| Reviewers | 5 | Invite modal + validation + safe dismissal verified; student blocked from `/reviewer` (good). Send/accept/feedback loop untestable. |
| Portfolio & public publishing | 2 | Listing works; **every detail page 500s**; publishing chain unreachable. |
| Settings, billing & integrations | 4 | Profile save round-trip verified. Billing shows contradictory period data; upgrade-pitch copy to Pro user; Stripe flows untested. |
| Reliability & error recovery | 5 | Console/network clean in normal use; 404s exist. But: unhandled server exception (portfolio), raw "Rate limit exceeded" replacing core content, unbranded near-invisible error pages, stale-UI track toggle. |
| **Overall functional completeness** | **5** | The execution spine is dependable; the proof/monetization edges are not. |

---

## 5. Prioritized findings

Confirmed defects are listed first within each priority, then design/UX/content recommendations, then unvalidated risks (§5.5). Viewport is 1440×900 desktop with mouse unless noted. Account state for all findings: authenticated Pro account, 9 projects, GitHub and Google Calendar disconnected, no reviewers, no published portfolio pages.

### 5.1 · P1 — High

---

**FUN-001 — Portfolio detail page crashes with a server-side exception for every entry**
- **Severity:** P1 · **Classification:** Confirmed defect
- **Route:** `/portfolio/[projectId]` (reproduced on three entries: `d89fb861…`, `46e02324…`, `9c32630e…` — identical digest each time, including a re-test at the end of the session)
- **Repro:** Portfolio → filter "All" → click "Open entry" on any card (or navigate directly to the URL).
- **Expected:** Portfolio entry detail with reflection, evidence, exports, publishing controls.
- **Actual:** Unbranded Next.js error page: "Application error: a server-side exception has occurred while loading sevri.co… Digest: 3277953323". Identical digest on both entries → systemic, not entry-specific.
- **Impact:** The entire completed-work → portfolio → résumé/Common App/public-page journey is unreachable. This is the product's second promise and it is fully down.
- **Evidence:** Two reproductions in one session; raw error page has no branding, no recovery link.
- **Likely cause (hypothesis, from read-only repo inspection):** the server component chain `src/app/(app)/portfolio/[projectId]/page.tsx` → `getPortfolioEntryDetailView` → `getPortfolioEntryDetailData` / `runFirstTimePortfolioCurationForPendingEntries` / `buildPortfolioEntryDetailViewFromData` (`src/lib/portfolio/portfolio-view.ts`) throws for existing entries — plausibly a null/shape mismatch on rows backfilled on Apr 23, 2026, or a failure inside first-time curation. Check server logs for digest 3277953323.
- **Recommended correction:** Root-cause and fix the exception; add an error boundary for the route that shows a branded, recoverable error; add a regression test that renders the detail view from a representative seeded entry (including entries with no submissions/exports/public page).
- **Acceptance criteria:** All 9 existing entries render without exception; an entry with minimal data (no submissions, no curation) renders; route-level error boundary shows branded fallback with a "Back to portfolio" action if a future exception occurs.
- **Related:** DES-015, RISK-001.

---

**FUN-002 — Track switch on the ideas board does not update the idea cards**
- **Severity:** P1 · **Classification:** Confirmed defect
- **Route:** `/recommendations` ↔ `/recommendations?track=research`
- **Repro:** Load `/recommendations` (Software board shown) → click the "Research" segment.
- **Expected:** The three option cards swap to the research board.
- **Actual:** URL, intro copy ("Explore multiple research directions…"), track badge, "Refresh research board" button, and the learning-loop "Closest option" list (which showed the three *research* titles) all update — but the three cards still show the *software* options, including "Choose this software project" buttons. Full page reload of `?track=research` shows the correct research cards, proving it's client-side staleness, not missing data.
- **Impact:** A student comparing research directions is silently shown software ideas; the page's two halves contradict each other; selecting from the stale board could create a project on the wrong track.
- **Likely cause (hypothesis):** the options list is memoized/keyed on initial server data and not re-fetched or re-keyed when the `track` search param changes.
- **Recommended correction:** Make the board react to the `track` param (refetch or hydrate both boards and switch client-side); key card list by track; add a loading state during swap.
- **Acceptance criteria:** Toggling tracks updates cards, badges, copy, and feedback list atomically without a reload, with a visible loading state if data must be fetched; deep links `?track=research` and `?track=software` both render correct boards.

---

**FUN-004 — Billing shows an active Pro plan with a period end 3+ months in the past**
- **Severity:** P1 · **Classification:** Confirmed defect (display and/or data-sync)
- **Route:** `/settings/billing`
- **Repro:** Open billing settings on the Pro account (July 24, 2026).
- **Expected:** An active subscription shows a current or future renewal date, phrased as renewal.
- **Actual:** "Sevri Pro is active." + "Current period ends: 4/11/2026". The page also exposes a "Sync billing now" button with copy acknowledging billing can "look behind."
- **Impact:** Users can't trust plan state; support burden; possible real entitlement drift (webhook missed) that could later cut off a paying user or keep serving a lapsed one.
- **Likely cause (hypothesis):** Stripe webhook sync (`/api/billing/webhook` → `subscriptions` table) missed renewal events, or the UI renders `current_period_end` without checking status semantics.
- **Recommended correction:** Verify webhook processing for renewal events; reconcile the subscriptions table against Stripe; change copy to "Renews on {date}" for active subs and add an inconsistency guard (if `current_period_end` < now while status=active, trigger automatic re-sync rather than exposing a manual button as primary recovery).
- **Acceptance criteria:** Active subs never display a past period end; a seeded stale record auto-resyncs or shows an explicit "we're refreshing your billing data" state; copy uses renewal language.
- **Related:** RISK-002, DES-014.

---

**FUN-005 — Progress percentages contradict each other across surfaces**
- **Severity:** P1 · **Classification:** Confirmed defect
- **Routes:** `/dashboard`, `/project/[id]`, `/portfolio`
- **Repro:** Compare "Interactive Portfolio Demo" across surfaces.
- **Expected:** One project has one progress number everywhere.
- **Actual:** Dashboard and project page: 3 of 5 steps → **72%**. Portfolio card: same project, "3 of 5 milestones complete" → **60%**. Another project: "2 of 5 complete" shows **68%** on the dashboard and **40%** in the portfolio. Projects with *zero* completed steps show **40%** on the dashboard ("Scoped") and **0%** in the portfolio. Momentum panel shows "Average progress 55%" computed from the inflated model.
- **Impact:** The motivational metric at the heart of the product is untrustworthy; a student "at 40%" having done nothing undermines the finishability ethos; support cannot explain the numbers.
- **Likely cause (hypothesis):** two formulas — a stage-weighted lifecycle model (Ideating→Shipped with a 40% "Scoped" baseline and small per-step increments) vs. simple `completed/total` in portfolio.
- **Recommended correction:** Pick one canonical progress definition (recommend simple step completion for "project progress," with lifecycle stage shown as a separate label, not folded into the percentage), implement it in one shared utility, and use it on dashboard, project, sidebar, portfolio, and momentum.
- **Acceptance criteria:** The same project shows the same percentage on all surfaces; a zero-step project shows 0% (stage shown separately as "Scoped"); a unit test covers the shared calculator.
- **Related:** DES-010.

---

**FUN-014 — Stored generated content is truncated mid-sentence and mid-word (titles and fields)**
- **Severity:** P1 · **Classification:** Confirmed defect (data/generation)
- **Routes:** `/recommendations`, `/dashboard`, `/portfolio`, `/calendar` (everywhere titles/summaries render)
- **Evidence:**
  - Stored project/recommendation title ends mid-word: "Performance landscape benchmark: cross-comparing reported modulators, detectors, and waveguides to identify **underexploit**" (and the same batch's card title ends "…waveguides to").
  - Recommendation detail fields cut mid-sentence: Core workflow ends "…and an **annotated.**"; MVP boundary ends "…**exportable.**" with an "IN:" list and no "OUT:".
  - Portfolio summary ends "…Limitation: the study​" (including a zero-width character).
- **Expected:** Complete sentences; titles that fit; explicit length constraints enforced at generation time with grammatical truncation.
- **Impact:** Broken titles propagate everywhere (dashboard, calendar chips, selects, portfolio) and look like the product is malfunctioning; truncated MVP boundaries destroy the usefulness of the comparison.
- **Likely cause (hypothesis):** hard `slice`/DB length caps applied after generation (e.g., compact/truncate utilities) rather than schema-level max-length constraints the model must satisfy, plus missing post-generation validation/repair.
- **Recommended correction:** Enforce length in the Zod schemas used by `generateStructuredOutput` (with repair-retry on violation), never hard-cut stored content mid-word; add sanitation that rejects/repairs outputs containing truncation artifacts; audit and regenerate or clean existing rows where feasible.
- **Acceptance criteria:** New generations never store mid-word truncations; titles fit within a defined budget; a validation test rejects outputs exceeding limits; existing display code renders long titles with CSS ellipsis rather than stored cuts.
- **Related:** DES-024, DES-025, RISK-007.

---

**DES-024 — Template-stitched generated copy is grammatically broken across Pitch Kit, Scope, and Portfolio**
- **Severity:** P1 · **Classification:** Content issue (systemic, confirmed)
- **Routes:** `/project/[id]/pitch-kit`, `/project/[id]/scope`, `/portfolio` listing summaries
- **Evidence (verbatim):**
  - Résumé bullet: "Built Interactive Portfolio Demo: Architectural Efficiency Case Study **to address a polished, single-demo web app** that presents… **walkthroughs..**" (mis-slotted template + double period + lowercase sentence start "the demo is tuned…").
  - Résumé bullet 2: "Scoped the MVP around a one-page spec… **criteria. and validated** progress against explicit milestones."
  - Talking point: "This project directly addresses **Sevri's target outcome** … and leverages **their** math and programming strengths **to...**" (trails off; refers to the student in third person and misattributes the outcome to Sevri).
  - Talking point 2: "It gives interviewers… **a focused way to the app walks the user through** a three-part case study…"
  - Scope: "Keep the MVP centered on **the app walks the user through a three-part case study**: … **justification. and avoid** optional feature creep."
  - Portfolio summaries: "**Building a small benchmark… is a focused research plan centered on building a small benchmark for better silicon photonics decisions? with** a practical, student-scale evidence path." (title echoed into itself, stray "?"); same pattern on "Computing Workflow Analyzer" and "Which Benchmark Pattern…".
- **Expected:** Publishable prose — these artifacts are the product's deliverable (résumé bullets, elevator pitch, Common App material).
- **Impact:** Directly contradicts "encouraging but credible"; a student pasting these into a résumé would be harmed. This is the highest-leverage content problem in the product.
- **Likely cause (hypothesis):** deterministic fallback templates (see `pipelines.ts` fallbacks) compose full sentences into slots expecting noun phrases ("centered on {problem}", "to address {description}", "a focused way to {workflow}"); some stored content came from fallbacks rather than model output.
- **Recommended correction:** Either generate these artifacts with the model (with schema validation) or rewrite fallback templates to compose grammatically (slot-type-aware: noun-phrase slots must receive noun phrases); add a lint pass that rejects ". and", "? with", "to...", double periods, and lowercase sentence starts; visibly label fallback content as a draft.
- **Acceptance criteria:** Pitch Kit, Scope, and portfolio summaries contain no mid-sentence periods/question marks, no trailing ellipsis fragments, no third-person references to the student, and no product-internal language ("Sevri's target outcome", "The profile is optimized for…"); fallback path has snapshot tests over representative inputs.
- **Related:** FUN-014, DES-026, RISK-007.

---

**DES-003 — "VISUAL PLACEHOLDER" ships in the landing-page How-it-works modal**
- **Severity:** P1 · **Classification:** Content issue (confirmed)
- **Route:** `/` → click "Direction" (or other How-it-works card)
- **Repro:** Click any of the three numbered How-it-works cards.
- **Expected:** A finished visual or no visual slot.
- **Actual:** The modal's left pane is a gradient block containing a picture icon and the literal text "VISUAL PLACEHOLDER".
- **Impact:** Instantly signals "unfinished product" to prospective users and parents on the primary conversion surface.
- **Recommended correction:** Ship real visuals (product screenshots fit the modal's purpose) or remove the visual pane; the modal also duplicates card text and adds only one sentence — consider removing the modal entirely and putting the one extra sentence on the card.
- **Acceptance criteria:** No placeholder text/graphics anywhere on public pages; modal (if kept) shows final artwork at all three breakpoints.

---

**DES-007 — No password reset path anywhere in the auth flows**
- **Severity:** P1 · **Classification:** Design/UX gap (confirmed absence)
- **Route:** `/sign-in`
- **Repro:** Inspect sign-in form; DOM contains no "Forgot password" link (`a[href*=forgot|reset]` absent).
- **Expected:** A standard "Forgot password?" flow (Supabase supports recovery emails).
- **Impact:** Email/password users (teenagers, who forget passwords at high rates) are permanently locked out; the only escape is the support email — and only if they think to check `/support`.
- **Recommended correction:** Add forgot-password → email recovery → reset screens; include rate limiting; link it under the password field.
- **Acceptance criteria:** A user can complete a full self-serve reset; invalid/expired tokens show recoverable errors; the link is keyboard-reachable and visible at all breakpoints.

### 5.2 · P2 — Medium

---

**FUN-003 — Calendar opens on April 2026 instead of the current month**
- **Severity:** P2 · **Classification:** Confirmed defect
- **Route:** `/calendar` (desktop month view and mobile agenda both affected)
- **Repro:** Open `/calendar` on July 24, 2026.
- **Actual:** "Month view — April 2026", selected day April 20, "2 items this month". Clicking "Today" jumps to July 2026 which shows "8 items this month · 2 overdue" — the state the user should have landed on, including two overdue items they'd otherwise never see.
- **Likely cause (hypothesis):** initial month derived from earliest scheduled item or persisted last selection instead of `new Date()`.
- **Recommended correction:** Default to the current month/day; keep deep-linking via query param if needed.
- **Acceptance criteria:** Fresh load shows the current month with today selected; overdue count visible without interaction.

---

**FUN-006 — Rate limiting replaces step-page content with a raw error and no recovery**
- **Severity:** P2 · **Classification:** Confirmed defect (error handling)
- **Route:** `/project/[id]/steps/4` (observed after repeated page loads in one session; 1024×768 and 1440×900; still present on a re-test ~20+ minutes later — the lockout window is long and unexplained to the user)
- **Actual:** A bare rose-tinted banner reading exactly "Rate limit exceeded" renders where the checklist was; the workbench degrades to "Open guidance to load the current coaching for this step." — the student's existing checklist (their own saved data) disappears; no retry timer, no explanation.
- **Impact:** Reading your own step page repeatedly (e.g., navigating between steps while working) can hide your checklist; the fallback copy misdirects users toward consuming an AI generation to get their checklist back.
- **Recommended correction:** Don't rate-limit reads of already-stored checklist/guidance (limit generation, not retrieval); when a limit is hit, keep cached content visible and show a human message with a retry-after; never replace persisted data with an error.
- **Acceptance criteria:** Stored checklist/guidance render even when rate-limited; rate-limit message includes what happened, when to retry, and doesn't use raw internal strings.
- **Related:** FUN-012.

---

**FUN-007 — Required onboarding fields accept whitespace-only values**
- **Severity:** P2 · **Classification:** Confirmed defect (validation)
- **Route:** `/onboarding` step 2 (Profile), Research track
- **Repro:** Replace "Interests" (required) with three spaces → Continue.
- **Actual:** Wizard advances to step 3; live summary shows an empty Interests chip. Whitespace-only passes the required check and would degrade generation quality if submitted.
- **Recommended correction:** Trim-validate all required text inputs (min length after trim) with inline errors; apply the same rule at the API/Zod layer.
- **Acceptance criteria:** Whitespace-only interests/subjects block progression with a visible error; server rejects trimmed-empty values.

---

**FUN-009 — Duplicate projects exist for the same idea with no differentiation or guard**
- **Severity:** P2 · **Classification:** Confirmed defect (observed data) with unvalidated cause
- **Routes:** `/dashboard`, `/portfolio`
- **Evidence:** Two identically titled projects "Building a small benchmark for better Silicon Photonics decisions" (one Scoped/0-steps, one Step 2/1-step), created the same day (Apr 3), with identical summaries.
- **Impact:** Confusing lists, split progress, ambiguous calendar/portfolio entries. The creation path ("Choose this project") was not re-executed for safety, so whether double-click/duplicate selection is currently guarded is unverified.
- **Recommended correction:** Disable the choose button during submission; detect an existing project from the same recommendation option and confirm before creating a second; provide archive/merge tooling for existing dupes.
- **Acceptance criteria:** Double-clicking "Choose this project" creates one project; re-choosing an already-chosen option warns; duplicates can be archived.
- **Related:** RISK-005.

---

**DES-002 — Scroll-reveal animation leaves blank/invisible content during normal use**
- **Severity:** P2 · **Classification:** Design/UX + performance concern (confirmed behavior)
- **Routes:** `/` (worst), `/pricing`, app pages (step page sections), 390×844 especially
- **Evidence:** Hero takes ~1.5–2s to fade in on load (nothing but background visible). On mobile, scrolling at normal speed repeatedly produced fully blank viewports (FAQ items, final CTA card, step-page "Done when" section) that only faded in after pausing; one screenshot shows a single FAQ item alone on an otherwise empty screen.
- **Impact:** Perceived slowness/brokenness; content-blocking animation harms LCP; screen-reader/reduced-motion users depend on the `prefers-reduced-motion` branch being complete (rules exist, but coverage unverified).
- **Recommended correction:** Render content visible by default and animate only transform/opacity *from* a visible baseline (or animate only above-the-fold once); ensure IntersectionObserver thresholds reveal content before it enters the viewport center; verify a no-motion experience shows everything immediately.
- **Acceptance criteria:** At 390w with fast scrolling, no viewport-height blank region ever appears; LCP element is not opacity-delayed; with reduced motion, all content is visible with no reveal delay.

---

**DES-010 — Progress model inflates and compresses (40% for zero work)**
- **Severity:** P2 · **Classification:** Design/UX issue
- **Routes:** `/dashboard`, `/project/[id]`
- **Evidence:** "Scoped" projects with zero completed steps display 40%; each completed step then adds only ~4–8 points (1/5→64%, 2/5→68%, 3/5→72%); "Shipped" jumps to 100%.
- **Impact:** Progress feels fake (students start at 40%) and then barely moves as real work completes — the inverse of a motivating meter, and it contradicts the finishability positioning.
- **Recommended correction:** See FUN-005 — separate lifecycle stage from percent-complete; percent should reflect executed work only.
- **Acceptance criteria:** Covered by FUN-005.

---

**DES-011 — Terminology and route naming drift across the app**
- **Severity:** P2 · **Classification:** Design/UX issue (systemic)
- **Evidence:** Sidebar "Project ideas" ↔ route `/recommendations` ↔ "Idea board" ↔ pricing "idea board generations"; sidebar "Presentation" ↔ breadcrumb "Pitch kit" ↔ route `/pitch-kit`; sidebar "Scope & Guardrails" ↔ breadcrumb "Scope"; "Research Lens" section on **software** projects contains a user/problem lens titled "Keep the user visible" (project page itself calls the same content "Project lens"); "steps" (project) vs "milestones" (portfolio, DB); route `/project/[id]` vs focus mode's `/projects/[id]/focus`; primary CTA "Explore a project" opens the onboarding wizard.
- **Impact:** Each individual drift is small; together they erode the "calm, coherent" quality bar and complicate support, testing, and analytics.
- **Recommended correction:** Adopt one glossary (suggest: Ideas, Scope, Project Lens, Pitch Kit, Steps) and apply it to sidebar, breadcrumbs, headings, and routes (with redirects); rename "Explore a project" to "New project".
- **Acceptance criteria:** One term per concept across sidebar/breadcrumb/heading/URL; no user-visible surface uses two names for the same thing.

---

**DES-012 — Portfolio lands on an empty "Completed (0)" filter**
- **Severity:** P2 · **Classification:** Design/UX issue
- **Route:** `/portfolio`
- **Evidence:** Default filter is Completed; with 0 completed projects the page's primary area is an empty state while stat cards show 9 projects. Filter resets to Completed on every load.
- **Impact:** First impression of the portfolio is "you have nothing," undermining the "record of what happened" framing.
- **Recommended correction:** Default to All (or remember last filter); keep the helpful empty-state copy for genuinely empty accounts.
- **Acceptance criteria:** A user with in-progress projects sees them immediately on `/portfolio` without interacting.

---

**DES-027 — Contradictory student facts across per-track intakes drive wrong generated context**
- **Severity:** P2 · **Classification:** Design/data issue
- **Routes:** `/onboarding` (both tracks), `/settings`, generated content
- **Evidence:** Software intake + settings say "College freshman"; the saved research intake says "High school junior"; research domain "electrical engineering" vs interests "silicon photonics". Generated software copy calls the user "an advanced college freshman."
- **Impact:** Singular facts (stage) forked per track produce inconsistent generated narratives about the same student — visible in portfolio/pitch materials.
- **Recommended correction:** Store identity-level facts (stage, name) once on the profile; intakes should carry only track-specific context; migrate/reconcile existing rows.
- **Acceptance criteria:** Changing stage in settings changes it everywhere; new intakes read stage from the profile.

---

**DES-015 — Error pages are unbranded, nearly invisible, and mislabeled**
- **Severity:** P2 · **Classification:** Design/UX issue (confirmed)
- **Routes:** invalid `/project/[id]`, `/p/[unknown]`, `/portfolio/[id]` (via FUN-001)
- **Evidence:** Default Next.js "404 This page could not be found" renders at very low opacity (the page-enter animation never completes on error pages — content stuck at its initial faded state); in-app invalid project shows sidebar copy "Project navigation is unavailable right now. Refresh the page to try again." for a permanent 404; `/p/*` 404 is bare with no link home.
- **Recommended correction:** Custom branded `not-found` and `error` pages (public + app variants) with recovery links; exclude error pages from enter animations; correct the sidebar fallback copy.
- **Acceptance criteria:** 404/500 pages are fully opaque, branded, and link to dashboard/home; invalid project IDs say "project not found," not "refresh."

---

**DES-001 — Every page shares the title "Sevri" (no per-route titles/metadata)**
- **Severity:** P2 · **Classification:** Design/SEO issue
- **Routes:** all (`/`, `/pricing`, `/privacy`, app pages…)
- **Evidence:** `document.title === "Sevri"` on every route inspected; portfolio detail tab shows the raw URL when the page crashes.
- **Impact:** SEO for pricing/marketing pages; browser history/tabs indistinguishable; screen readers announce no page context on navigation.
- **Recommended correction:** Route-level `metadata`/`generateMetadata` (e.g., "Pricing — Sevri", "Step 4 · {Project} — Sevri"); add OG tags for public pages.
- **Acceptance criteria:** Distinct, descriptive titles on all public routes and templated titles on app routes.

### 5.3 · P3 — Low (selected, still worth fixing)

- **DES-004** — How-it-works modal: focus stays on the trigger card when the dialog opens (`aria-modal="true"` but `document.activeElement` remained the button). Move focus to the dialog on open. *(Accessibility)*
- **DES-005** — Marquee duplicates all five value cards in the DOM without `aria-hidden` on clones (screen readers hear 10 cards); visible numbering runs 05→01 against reading order. *(Accessibility/content)*
- **DES-008** — Auth inputs lack `autocomplete` (`email`, `current-password`, `new-password`) and `name` attributes; no password visibility toggle. *(Form usability)*
- **DES-009 / FUN-010** — Authenticated users see full sign-in/sign-up forms (no redirect to `/dashboard`), pricing plan cards still say "Start free / Create account," footer still says "Sign in." *(State-aware CTAs)*
- **DES-013** — Calendar event chips overflow their day cell into adjacent cells (Jul 8 chip overlaps Jul 9; Apr 12 overlaps Apr 13). *(Visual defect)*
- **DES-014** — Billing page shows "Why upgrade" pitch and free-plan subheader ("Start free, explore up to 4 idea boards…") to an active Pro subscriber. *(Contextual copy)*
- **DES-016** — No skip-to-content link on any page. *(Accessibility)*
- **DES-017** — "Show step detail" label doesn't change to "Hide…" when expanded; FAQ/accordion buttons lack `aria-controls`. *(Accessibility polish)*
- **DES-019** — Account menu (Settings/Sign out) doesn't close on Escape. *(Accessibility)*
- **DES-020** — Idea metrics "FINISH 8/10 / WOW 6/10 / TIMELINE / WEEKLY" are unexplained abbreviations; "Track readiness: Ready to compare" is vague. Add tooltips/legend and human labels ("Finishability", "Impressiveness"). *(Content)*
- **DES-021** — Fixed "Ready when you are / Submit work" bar permanently overlaps page content; at small heights (200% zoom) it covers the H1; ensure content padding clears it and consider collapsing on scroll. *(Layout)*
- **DES-022** — Mobile breadcrumb collapses to "Dashboard" only on step pages (project context lost). *(Mobile IA)*
- **DES-023** — Footer lacks a copyright/legal line; "Overview" is an unusual label for Home. *(Polish)*
- **DES-025** — Unsanitized model artifact in stored content: "sampling, quantization, and alias別" (CJK character mid-word). Add output sanitation. *(Content defect — would be P2 if frequent; one instance found)*
- **DES-026** — "Authenticity note" and "Project lens" speak about the student in the third person and echo internal generation-context framing ("The profile is optimized for…"). Rewrite second-person. *(Content)*
- **DES-028** — "Delay these until later" items are each prefixed "Stretch later:" and phrased as removals ("Remove the downloadable summary…"), reading as contradictory instructions. Normalize phrasing ("Later: add X"). *(Content)*
- **FUN-008** — Onboarding wizard state is lost on refresh with no warning or draft persistence. *(Resilience)*
- **FUN-011** — Focus mode lives at `/projects/[id]/focus` (plural) while everything else uses `/project/[id]`; ending a block early lands on `?from=focus#submission-area` auto-opening the submission form — reasonable, but the plural/singular split invites 404 regressions. *(Routing hygiene)*
- **FUN-012** — Raw internal error strings shown to users: "Invalid login credentials" (Supabase) and "Rate limit exceeded". Map to human copy. *(Error copy)*

### 5.4 · Positive verifications (no finding)

Checklist toggle persists across reload and restores cleanly; step "current task" pointer advances correctly; profile save round-trip works with validation and disabled-state feedback; calendar work-block validation blocks empty dates; reviewer invite modal validates email, closes on Escape without sending, and states plan limits (0 of 2) and expiry; student access to `/reviewer` is denied (redirects to dashboard); focus block start/pause/end-early loop works; console and network were clean on normal dashboard loads; `prefers-reduced-motion` CSS rules exist; focus outlines are visible and high-contrast; the 13+/16+ age attestations exist at sign-up and (per policy text) at publishing.

### 5.5 · Unvalidated risks (do **not** treat as confirmed defects)

- **RISK-001 — Portfolio publishing safety chain unverified.** Display-name choice, age-16 attestation, publication validation, unpublish flow, and public-page privacy boundaries could not be inspected because the detail page crashes (FUN-001). After fixing FUN-001, run a targeted audit of the publish flow before enabling it broadly.
- **RISK-002 — Stripe entitlement drift.** FUN-004 may indicate webhook processing gaps. Reconcile all subscriptions against Stripe; verify checkout success/cancel paths and portal return behavior (not executed here).
- **RISK-003 — GitHub/Google integration states.** Only disconnected states were seen. Connected-state UI, repo linking validation, commit sync/attribution, calendar event creation, and disconnect warnings are untested.
- **RISK-004 — Momentum "proof" metrics.** Commits 0 / Words 0 despite completed steps; plausibly correct (GitHub disconnected; no text submissions) but verify these counters are actually wired to data sources.
- **RISK-005 — Duplicate-selection guard.** Duplicates exist (FUN-009); whether the current "Choose this project" flow still permits them was not re-tested to avoid creating projects.
- **RISK-006 — Reviewer-side access boundaries.** Reviewer read-only scope, feedback forms, and invitation acceptance were untestable without sending a real invitation.
- **RISK-007 — Which pipeline stage produced the broken content.** The template-stitch signature suggests deterministic fallbacks; confirm from generation metrics/logs whether affected rows came from fallback or model output before choosing the fix (template rewrite vs. schema/validation).
- **RISK-008 — Rate-limit thresholds.** A single active audit session tripped read-path limits on step pages. Review whether normal student navigation can hit the same limits.

---

## 6. Journey-level synthesis

**Visitor → sign-up.** Strong story, strong craft. Breaks: hero invisible for the first ~2 seconds; "VISUAL PLACEHOLDER" in the very modal that explains the product (DES-003); blank regions while scrolling on mobile (DES-002); every page titled "Sevri" (DES-001). The pricing page answers objections well, and the free tier is honest ("4 idea board generations" matches actual enforcement — verified against plan limits).

**New student → completed onboarding.** The wizard is well-paced, prefills correctly, and the live summary is a nice trust device. Breaks: whitespace passes required validation (FUN-007); a refresh silently discards progress (FUN-008); track switching changes the outcome answer without explanation (per-track intakes — DES-027); final-submit behavior (dup-generation guard, redirect) untested by policy.

**Intake → idea comparison → selection.** The three-card comparison with effort/finishability framing is the product's intellectual core and reads well. Breaks: the track toggle shows the wrong board (FUN-002); stored option content is truncated mid-sentence, including the MVP boundary — the exact field a student needs to compare scope (FUN-014); "WOW/FINISH" metrics unexplained (DES-020); duplicates suggest selection isn't idempotent (FUN-009/RISK-005).

**Selected project → roadmap → completed milestone.** The strongest journey. Overview → scope → steps is coherent; the step workspace (checklist, current task, done-when, coaching notes) is excellent; persistence verified. Breaks: progress numbers contradict across surfaces and start at 40% (FUN-005/DES-010); "Research Lens" labeling on software projects (DES-011); scope page's core sentence is garbled (DES-024); rate-limiting can hide a student's own checklist (FUN-006).

**Project progress → calendar execution.** Work-block planning with "I will / after calculus / library" implementation-intention framing is thoughtful. Breaks: opens on a stale month, hiding overdue items (FUN-003); chips overflow cells (DES-013); export/Google sync untested; hidden projects say "dates still need a schedule" without a path to schedule them from here.

**Completed work → portfolio/export/public proof.** Broken end-to-end: every entry detail 500s (FUN-001); listing summaries are template-garbled (DES-024); progress numbers disagree with the dashboard (FUN-005); publishing/export/RISK-001 unverifiable. This journey needs to work for the product's promise to be true.

**Student → reviewer feedback.** The invite modal is well-scoped (read-only, expiry, no billing) and student access to reviewer routes is correctly denied. The rest of the loop (send → accept → feedback → visibility) is unbuilt or unverifiable from this account; the step page's "Reviewer feedback" panel is ready and waiting.

**Free user → upgrade decision.** Pricing page and gates are coherent (Free: 4 boards, no coaching/portfolio packaging; Pro: unlimited fair-use). Breaks: a Pro user still sees upgrade pitches and "Create account" CTAs (DES-009/DES-014); the billing period contradiction (FUN-004) would make anyone hesitate to pay; "Manage subscription" path untested.

---

## 7. Quick wins versus structural work

**Small, high-impact fixes (days):**
- Remove/replace "VISUAL PLACEHOLDER" (DES-003).
- Calendar default month = today (FUN-003).
- Portfolio default filter = All (DES-012).
- Per-route page titles (DES-001).
- "Renews on" copy + past-date guard on billing display (display half of FUN-004).
- Trim-validation on onboarding required fields (FUN-007).
- Human error strings for rate-limit and invalid-credential cases (FUN-012).
- Forgot-password link + Supabase recovery flow (DES-007).
- `autocomplete` attributes on auth forms (DES-008).
- Escape-close for account menu; focus-into-dialog for marketing modal; `aria-hidden` on marquee clones (DES-019/004/005).

**Medium product/design improvements (1–3 weeks):**
- Unify progress calculation into one shared utility used everywhere (FUN-005/DES-010) — medium because it's a product decision plus refactor plus migration of displayed values.
- Fix ideas-board track switching state model (FUN-002).
- Branded error/not-found pages, animation-free (DES-015).
- Terminology unification incl. breadcrumbs/labels/routes with redirects (DES-011).
- Scroll-reveal rework to visible-by-default (DES-002).
- Read-path rate-limit exemption + graceful degradation (FUN-006).
- State-aware marketing/auth CTAs (DES-009/FUN-010).
- Duplicate-selection guard + archive tooling (FUN-009).

**Structural / architectural work (multi-week):**
- Portfolio detail crash root-cause plus error-boundary strategy and seeded regression tests (FUN-001) — the fix may be small but the reliability work around it (error boundaries, logging, tests for backfilled data shapes) is structural.
- Generation content quality system: schema-level length enforcement with repair-retry, grammatical fallback templates, output sanitation (mojibake, truncation artifacts), fallback labeling, and regeneration/cleanup of stored broken rows (DES-024/FUN-014/DES-025/RISK-007).
- Profile-vs-intake data model: move singular student facts to the profile; migrate existing intakes (DES-027).
- Stripe reconciliation job + webhook hardening (FUN-004/RISK-002).

**Product-owner decisions needed (not pure implementation):**
- What "project progress %" means (stage-weighted vs. pure step completion) — blocks FUN-005.
- Whether the marketing How-it-works modals earn their keep vs. inline content (DES-003).
- Canonical glossary: Ideas vs Recommendations, Pitch Kit vs Presentation, steps vs milestones (DES-011).
- Whether Free users should see roadmaps (pricing table says included; confirm intended gates match `limits.ts`).
- Rate-limit budget for read paths (RISK-008).
- Whether to regenerate existing users' broken pitch/scope/summary content or grandfather it (cost/quota decision).

---

## 8. Final implementation prompt for another agent

```text
You are a senior full-stack engineer working in the Sevri repository. Your job is to fix a
prioritized set of audited defects and design issues without regressing anything else.

=== PRODUCT CONTEXT ===
Sevri (https://sevri.co) is a project-to-portfolio coaching product for high-school and
early-college students (13+). Core journeys:
 1) Sign up -> 4-step onboarding intake (Software or Research track) -> AI-normalized profile.
 2) /recommendations "idea board": 3 generated project options per track, compared on
    timeline/weekly hours/finishability/impressiveness; user selects one.
 3) Selection creates a project with a 5-step generated roadmap. Project workspace:
    Overview, Scope & Guardrails, Research Lens (user/problem lens), Pitch Kit
    (elevator pitch, resume bullets, talking points), and step pages
    (/project/[id]/steps/[n]) with checklist, guidance, done-when criteria, submissions,
    focus mode (25-min blocks at /projects/[id]/focus), and reviewer feedback.
 4) /calendar: month view, work-block planning, .ics export (Pro).
 5) /portfolio: listing + entry detail (reflection, evidence, exports, resume bullets,
    optional public page at /p/... with an age-16 attestation).
 6) Reviewers: students invite up to 2 (Pro) reviewers by email; reviewers get a
    read-only view and leave structured feedback.
 7) Billing: Free (4 idea-board generations total, no step coaching/portfolio packaging)
    vs Pro Monthly $10 (unlimited fair-use generations, coaching, portfolio features).

Stack: Next.js App Router, React, TypeScript, Tailwind, Supabase (Auth/Postgres/RLS),
Stripe (Checkout + webhook -> subscriptions table), OpenAI Responses API for generation
(src/lib/ai/client.ts generateStructuredOutput with Zod schemas, retry/repair, fallback
models; three pipeline stages in src/lib/ai/pipelines.ts with deterministic fallbacks),
Resend for email. Route groups: (marketing), (auth), (app). DB access via
src/lib/db/queries/* and src/lib/db/mutations/*. Plan gates in src/lib/usage/limits.ts.
Rate limiting via usage_events in src/lib/usage/rate-limit.ts. Path alias @/ -> src/.
Verification tools: npm run lint, npm run typecheck, npm run build (there are currently
no automated tests — you will add targeted ones).

=== PRODUCT / DESIGN PRINCIPLES (apply to all fixes) ===
- Encouraging but credible; editorial and polished; never childish.
- Calm, coherent, trustworthy: one term per concept, one number per fact.
- Finishability first: progress and scope displays must be honest.
- Every interactive change needs explicit loading, success, empty, disabled, and error
  states; errors must be human-readable and recoverable.
- Accessibility is non-negotiable: semantic structure, keyboard support, visible focus,
  focus management in dialogs, sufficient contrast, reduced-motion support, 44px-ish
  touch targets, no color-only signaling.
- Never weaken auth, RLS, rate limits (except the specific read-path change below),
  validation, privacy safeguards, age attestations, or billing enforcement to make
  something pass.
- Preserve existing user data. Any migration must be additive and reversible.
- Reuse the existing design system components; inspect them before writing new UI.
- Fix root causes. Several findings are systemic (shared progress math, shared
  template/generation utilities, shared error pages) — fix once in a shared place,
  not per page.

=== IMPLEMENTATION SEQUENCE ===
Work in this order (dependency + risk):
 Phase A: A1, A2, A3 (unblock broken journeys and billing trust)
 Phase B: B1, B2, B3 (content integrity system)
 Phase C: C1..C6 (journey-breaking P2s)
 Phase D: D1..D12 (accessibility + consistency + polish)
Do not start Phase B until Phase A compiles, passes lint/typecheck/build, and the
portfolio detail page renders in a browser.

=== PHASE A — P1 CONFIRMED DEFECTS ===

[A1 / FUN-001] Portfolio detail page crashes (server exception, digest 3277953323).
  Route: /portfolio/[projectId] — crashes for EVERY entry (verified on two).
  Files: src/app/(app)/portfolio/[projectId]/page.tsx,
         src/lib/portfolio/portfolio-view.ts (getPortfolioEntryDetailView,
         buildPortfolioEntryDetailViewFromData, first-time curation call),
         src/lib/db/queries/portfolio.ts.
  Task: Reproduce locally with production-shaped data (entries backfilled ~2026-04-23,
        some with zero submissions/exports/public pages, milestones counts of 4 or 5).
        Root-cause the throw (check server logs for the digest; suspect null/shape
        mismatch or the first-time-curation path). Fix so ALL existing entries render.
        Add an error.tsx boundary for the route with branded copy and a "Back to
        portfolio" link. Add a unit/integration test that builds the detail view from:
        (a) a full entry, (b) a minimal entry (no submissions/curation/public page),
        (c) an entry whose curation previously failed.
  Acceptance: every seeded entry renders; minimal-data entry renders; forced exception
        shows the branded boundary, never the raw Next.js error page.
  Do NOT "fix" this by swallowing errors and rendering empty sections silently.

[A2 / FUN-004 + RISK-002] Billing shows "Pro active" with "Current period ends:
  4/11/2026" while today is months later; a manual "Sync billing now" button exists.
  Task: (1) Display: for status=active, render "Renews on {date}"; if
        current_period_end < now while status=active, do NOT show the stale date —
        show a syncing state and trigger a server-side re-sync from Stripe
        automatically. (2) Verify the webhook handler processes renewal
        (invoice.paid / customer.subscription.updated) events and updates
        current_period_end; add a reconciliation script or admin path that re-syncs a
        user's subscription from Stripe. (3) Remove the upgrade-pitch panel and
        free-plan subheader copy on /settings/billing for active Pro users; show
        plan-management context instead (DES-014).
  Acceptance: seeded stale-active subscription auto-corrects on page load (or shows
        explicit refreshing state); active subs never render a past date; Pro users see
        no "why upgrade" pitch. Do not change plan gates in limits.ts.
  Treat "webhook is actually broken in prod" as unvalidated (RISK-002): build the
  guard + reconciliation regardless of root cause.

[A3 / FUN-002] Ideas board track toggle leaves stale option cards.
  Route: /recommendations?track=software|research (client component).
  Symptom: toggling updates URL, header copy, badge, refresh button, and the
  learning-loop option list, but the three option cards keep the previous track's
  content until a full reload.
  Task: Make the option cards derive from the same track-keyed state/fetch as the rest
        of the page (re-fetch on track change or hydrate both boards and key the list
        by track). Add a loading state during swap. Ensure "Choose this software/
        research project" button labels and actions always match the rendered option.
  Acceptance: toggling swaps cards without reload; deep links render the right board;
        no frame in which the badge says Research while cards say software.

=== PHASE B — GENERATED-CONTENT INTEGRITY (P1) ===

[B1 / FUN-014] Stored generated content is truncated mid-word/mid-sentence.
  Observed: project/recommendation title stored as "...waveguides to identify
  underexploit"; option card title ending "...waveguides to"; Core workflow ending
  "...and an annotated."; MVP boundary ending "...exportable." (IN: list with no OUT);
  portfolio summary ending "Limitation: the study" + zero-width char.
  Task: (1) Enforce max lengths in the Zod schemas passed to generateStructuredOutput
        so the MODEL must satisfy them (with the existing repair-retry loop), instead
        of hard-slicing after generation. Find and remove/replace any post-hoc
        truncation of stored content (e.g., compactText-style helpers writing cut
        strings to the DB; display-layer truncation must use CSS ellipsis instead).
        (2) Add output sanitation: reject/repair outputs containing mid-word cuts,
        dangling conjunctions/prepositions at end-of-field, zero-width characters, or
        mixed-script artifacts like "alias別" (DES-025). (3) Write a one-off audit
        script listing affected stored rows (titles/fields matching truncation
        heuristics) so the owner can decide regenerate-vs-keep; do not mass-regenerate
        automatically (quota).
  Acceptance: unit tests prove over-length model output triggers repair, not storage;
        no code path stores a mid-word cut; the audit script runs and reports counts.

[B2 / DES-024] Template-stitched copy is grammatically broken (systemic).
  Observed verbatim examples:
   - Pitch Kit resume bullet: "Built {title} to address {app description}... the demo
     is tuned for portfolio presentation and interview walkthroughs.." (mis-slotted
     clause, lowercase sentence start, double period)
   - "Scoped the MVP around {deliverable}. and validated progress against explicit
     milestones."
   - Talking point: "This project directly addresses Sevri's target outcome ... and
     leverages their math and programming strengths to..." (trails off with "to...";
     third-person "their"; internal framing "Sevri's target outcome")
   - "It gives {audience} a focused way to {core workflow sentence}" producing
     "...a focused way to the app walks the user through..."
   - Scope page: "Keep the MVP centered on {core workflow sentence}. and avoid
     optional feature creep."
   - Portfolio listing summaries: "{Title} is a focused research plan centered on
     {lowercased title}? with a practical, student-scale evidence path."
  Task: Locate the deterministic fallback/template composition (pipelines.ts fallbacks
        and any summary builders). Rewrite so noun-phrase slots receive noun phrases
        (derive short phrases from structured fields rather than reusing full
        sentences), sentences are composed with correct casing/punctuation, and the
        student is addressed in second person ("your") with no internal vocabulary
        ("Sevri's target outcome", "The profile is optimized for..."). Add a content
        lint (unit-tested) rejecting: ". and", "? with", trailing "to...", double
        periods, mid-sentence lowercase starts after periods. Prefer model generation
        with schema validation for resume bullets / elevator pitch if feasible; if a
        fallback produced the artifact, label it in the UI as a draft ("Draft — refine
        wording before using").
  Acceptance: snapshot tests over representative GenerationContexts produce clean
        prose; the content lint passes on all fallback outputs; no user-visible string
        refers to the student in third person or to internal profile machinery.
  First verify (RISK-007) from generation metrics/logs whether the broken rows came
  from fallbacks or the model, and note the answer in your summary.

[B3 / DES-026 + DES-028] Content voice fixes: rewrite "Authenticity note" and
  "Project lens" prose to address the student directly; normalize the Scope page's
  "Delay these until later" list so each item is phrased as a deferral ("Later: ...")
  without the redundant "Stretch later:" prefix and without imperative "Remove/Drop"
  phrasing that reads as a cut-now instruction.

=== PHASE C — JOURNEY-BREAKING P2 DEFECTS ===

[C1 / FUN-005 + DES-010] One progress number everywhere.
  Observed: same project = 72% (dashboard, project page, sidebar) vs 60% (portfolio
  "3 of 5 milestones"); another = 68% vs 40%; zero-step projects = 40% (dashboard)
  vs 0% (portfolio); momentum "Average progress 55%" uses the inflated model.
  Product decision (already made for you): progress % = completed steps / total steps.
  Lifecycle stage (Ideating/Chosen/Scoped/Steps/Shipped) remains a separate label and
  must NOT be folded into the percentage.
  Task: Implement a single shared calculator (e.g., src/lib/progress.ts) and use it in
        dashboard hero + project list, project overview, project sidebar card,
        portfolio listing/detail, and momentum averages. Unit-test it.
  Acceptance: identical % for the same project on every surface; zero-step projects
        show 0% with stage "Scoped"; momentum average recomputed accordingly.

[C2 / FUN-003] Calendar must open on the current month with today selected
  (desktop month view AND mobile agenda). Preserve month deep-linking if present.
  Acceptance: fresh load in July shows July, today highlighted, overdue count visible.

[C3 / FUN-006 + FUN-012 + RISK-008] Rate limiting must not hide stored data.
  Observed: after repeated step-page loads, a raw "Rate limit exceeded" banner
  replaced the checklist, and the workbench fell back to "Open guidance to load the
  current coaching for this step." even though checklist data exists.
  Task: Exempt reads of already-stored checklist/guidance from rate limiting (limit
        generation endpoints, not retrieval), or serve cached content when limited.
        When a limit IS hit, show human copy ("You're moving fast — try again in about
        a minute.") with the stored content still visible. Map raw internal strings
        ("Rate limit exceeded", "Invalid login credentials") to human copy at the UI
        boundary. Review read-path thresholds so normal step-to-step navigation cannot
        trip them.
  Acceptance: with the limiter forced on, the step page still shows the checklist;
        no raw internal error strings are user-visible. Do NOT remove rate limiting
        from generation/mutation endpoints.

[C4 / FUN-007] Onboarding trim-validation: required text fields (Interests, Favorite
  subjects, etc.) must reject whitespace-only values client-side (inline error) and
  server-side (Zod .trim().min(1)). Acceptance: "   " blocks progression with a
  visible error; server rejects trimmed-empty submissions.

[C5 / FUN-009 + RISK-005] Duplicate project guard: disable "Choose this project"
  while the selection request is in flight; if a project already exists from the same
  recommendation option, require an explicit confirmation ("You already started this
  idea — start another copy?"). Add an archive action so existing duplicates can be
  hidden without deletion. Acceptance: double-click creates one project; re-selection
  warns; archived projects leave dashboards/calendars but retain data.

[C6 / DES-002] Scroll-reveal must never blank content.
  Observed: hero invisible ~2s on load; at 390w, normally-paced scrolling produced
  fully blank viewports (FAQ items, final CTA, app "Done when" section) until pausing.
  Task: Make content visible by default; run reveal animations only as enhancements
        (small translate/opacity from >= 60% visible baseline, generous rootMargin so
        content reveals before entering center screen); ensure the LCP element is not
        opacity-gated; honor prefers-reduced-motion by disabling reveals entirely
        (verify the existing media-query branch covers ALL reveal/marquee/menu
        animations). Apply to marketing pages AND app sections.
  Acceptance: fast mobile scroll shows no blank viewport-height regions; Lighthouse
        LCP not degraded; with reduced motion emulated, everything is visible
        immediately.

=== PHASE D — ACCESSIBILITY, CONSISTENCY, POLISH ===

[D1 / DES-007] Add a full forgot-password flow (link under password field on
  /sign-in -> request form -> Supabase recovery email -> reset page). Human errors for
  invalid/expired tokens. Rate-limit requests. Acceptance: complete self-serve reset
  works; link keyboard-reachable at all widths.
[D2 / DES-001] Per-route metadata: descriptive <title> (and description/OG for
  marketing routes). Pattern: "Pricing — Sevri", "Step 4 · {Project name} — Sevri".
[D3 / DES-015] Branded not-found and error pages for (marketing), (app), and /p/*.
  Exclude error pages from page-enter animations (they currently render ~invisible).
  Replace the misleading sidebar fallback "Project navigation is unavailable right
  now. Refresh the page to try again." with a proper not-found treatment when the
  project id doesn't exist.
[D4 / DES-011] Terminology unification (product decision provided): use "Ideas"
  (nav label "Project ideas" stays but breadcrumb/headings align), "Scope &
  Guardrails" everywhere (breadcrumb currently "Scope"), "Pitch Kit" everywhere
  (sidebar currently "Presentation"), "Project Lens" for the lens section on BOTH
  tracks (nav + breadcrumb currently "Research Lens"; the software project's lens
  content already titles itself "Keep the user visible"), "steps" as the single term
  for roadmap items in user-facing copy (portfolio currently says "milestones").
  Rename the sidebar primary button "Explore a project" -> "New project". Unify the
  focus-mode route under /project/[id]/... with a redirect from the old /projects/...
  path.
[D5 / DES-012] /portfolio default filter = "All" (remember last selection per user is
  optional; must not default to an empty Completed tab when 0 completed).
[D6 / DES-009 + FUN-010] State-aware auth surfaces: authenticated users hitting
  /sign-in or /sign-up are redirected to /dashboard; marketing pricing CTAs for
  authenticated users read "Open workspace" / "Upgrade" as appropriate; footer swaps
  "Sign in" for "Workspace".
[D7 / DES-004 + DES-005 + DES-019 + DES-017 + DES-016] Accessibility batch:
  move focus into the marketing how-it-works dialog on open (and back on close —
  restore already works); aria-hidden="true" on duplicated marquee cards (and fix the
  visible numbering to read 01..05 in DOM order); close the account menu on Escape;
  toggle disclosure labels ("Show step detail" <-> "Hide step detail") and add
  aria-controls to accordion/disclosure buttons; add a skip-to-content link in both
  layouts. Also replace the marketing modal's "VISUAL PLACEHOLDER" pane per DES-003
  (real screenshot asset or remove the pane).
[D8 / DES-008] Auth form hygiene: autocomplete="email" / "current-password" /
  "new-password", name attributes, and a password visibility toggle.
[D9 / DES-013] Calendar chips must clip within their day cell (overflow hidden +
  "+N" overflow indicator) instead of overlapping adjacent days.
[D10 / DES-020] Idea metrics: replace "FINISH"/"WOW" labels with "Finishability" and
  "Impressiveness" (or add an explanatory tooltip/legend) and add a legend for
  TIMELINE/WEEKLY; replace "Track readiness: Ready to compare" with copy that says
  what it means.
[D11 / DES-021 + DES-022] Step page bottom bar: ensure content bottom-padding always
  clears the fixed bar; consider auto-collapsing it on scroll on mobile; restore
  project context to mobile breadcrumbs (at minimum "{Project} / Step N").
[D12 / DES-027] Data model: student stage (and other identity facts) live on the
  profile, not per-track intakes. Migration: backfill profile stage from the most
  recent intake; intakes reference the profile value going forward; settings edit
  updates the single source. Acceptance: research and software generated content
  describe the same student stage.

=== UNVALIDATED RISKS — INVESTIGATE, DO NOT BLIND-FIX ===
- RISK-001: After A1, audit the publish flow end-to-end (display-name choice, age-16
  attestation, validation, unpublish, /p/ page privacy) before enabling broadly.
- RISK-003: GitHub/Google connected-state UI, repo-link validation, commit sync, and
  disconnect warnings are untested; verify with a test account before changing.
- RISK-004: Verify momentum "Commits"/"Words" counters are wired to real data.
- RISK-007: Confirm from generation metrics whether broken content came from
  fallbacks or the model; record the answer.
- Do not restructure RLS, auth, or webhook security as part of any of this.

=== VERIFICATION REQUIREMENTS (every phase) ===
- npm run lint, npm run typecheck, npm run build must pass.
- Add tests appropriate to each fix: unit tests for the progress calculator, schema
  length enforcement, content lint, trim validation, billing date guard; integration/
  render tests for portfolio detail (three data shapes) and recommendations track
  switching; snapshot tests for fallback template output.
- Browser-verify each changed surface at 1440x900, 1024x768, and 390x844, plus
  keyboard-only operation of any changed interactive element, plus reduced-motion
  emulation for C6.
- Regression checklist before finishing:
  [ ] All 9 portfolio entries open; [ ] dashboard/project/portfolio show identical
  progress for 3 sampled projects; [ ] track toggle swaps cards live; [ ] calendar
  opens on the current month; [ ] step 4 checklist toggles and persists after reload;
  [ ] focus block start/end still works; [ ] reviewer invite modal validates and
  closes on Escape without sending; [ ] settings profile save round-trip works;
  [ ] sign-in with wrong credentials shows a human error; [ ] billing page shows
  renewal date; [ ] marketing pages have unique titles and no placeholder content;
  [ ] no raw "Rate limit exceeded" or Next.js default error page reachable;
  [ ] existing user data (projects, checklists, intakes, subscriptions) untouched by
  migrations except where specified.

=== DELIVERABLE ===
Finish with a summary of: files changed (grouped by finding ID), tests added and their
results, the RISK-007 determination, any finding you could not safely implement and
why, remaining risks, and product decisions still needed.
```


