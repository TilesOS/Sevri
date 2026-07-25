// Deterministic composition of the project workspace's written surfaces:
// the scope statement, the deferral list, and the pitch kit.
//
// The model is asked to write the pitch kit as part of roadmap generation (see
// `PitchKitSchema`), and that output is preferred whenever it exists. This module
// is the deterministic draft used when it does not — for roadmaps generated
// before the schema carried a pitch kit, and for the rare generation that omits
// one. Drafts are labeled as drafts in the UI.
//
// Composition rule: a stored model field is never pasted into the middle of a
// hand-written sentence. Fields either occupy their own sentence, or are passed
// through `asInlinePhrase`, which refuses anything sentence-shaped.
//
// Pure functions, no I/O.

import { lintProse } from "../text/content-lint.ts";
import {
  asInlinePhrase,
  asSentence,
  joinSentences,
  labeledSentence,
  normalizeWhitespace,
  stripTerminalPunctuation,
} from "../text/prose.ts";
import { toStudentVoice } from "../text/student-voice.ts";
import type { ProjectTrack } from "@/types/domain";

export interface PitchKitTalkingPoint {
  label: string;
  body: string;
}

export interface PitchKitContent {
  elevatorPitch: string;
  resumeBullets: string[];
  talkingPoints: PitchKitTalkingPoint[];
  /** True when this content was composed deterministically rather than written by the model. */
  isDraft: boolean;
}

export interface SoftwareSeed {
  target_user?: unknown;
  problem_statement?: unknown;
  core_workflow?: unknown;
  mvp_boundary?: unknown;
  validation_plan?: unknown;
}

export interface ResearchSeed {
  research_question?: unknown;
  hypothesis_or_focus?: unknown;
  methodology?: unknown;
  evidence_plan?: unknown;
  scope_boundaries?: unknown;
  limitation_note?: unknown;
}

export interface PitchKitSource {
  projectTrack: ProjectTrack;
  projectTitle: string;
  seed: SoftwareSeed | ResearchSeed;
  /** The first roadmap step's deliverable, used to describe what was scoped. */
  firstDeliverable?: string | null;
  stepCount?: number;
  /** The selected option's rationale, shown as the "Why this project" talking point. */
  whyItFits?: string | null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

/**
 * The selected option's rationale, rewritten into second person — but only if the
 * result reads cleanly. A rationale that arrives as a fragment is dropped rather
 * than passed through, so this module's output is always lint-clean.
 */
function usableRationale(whyItFits: string | null | undefined): string {
  if (typeof whyItFits !== "string" || whyItFits.trim().length === 0) return "";
  const rewritten = asSentence(toStudentVoice(whyItFits));
  return lintProse(rewritten).length === 0 ? rewritten : "";
}

function asSoftwareSeed(seed: SoftwareSeed | ResearchSeed): Required<Record<keyof SoftwareSeed, string>> {
  const source = seed as SoftwareSeed;
  return {
    target_user: readString(source.target_user),
    problem_statement: readString(source.problem_statement),
    core_workflow: readString(source.core_workflow),
    mvp_boundary: readString(source.mvp_boundary),
    validation_plan: readString(source.validation_plan),
  };
}

function asResearchSeed(seed: SoftwareSeed | ResearchSeed): Required<Record<keyof ResearchSeed, string>> {
  const source = seed as ResearchSeed;
  return {
    research_question: readString(source.research_question),
    hypothesis_or_focus: readString(source.hypothesis_or_focus),
    methodology: readString(source.methodology),
    evidence_plan: readString(source.evidence_plan),
    scope_boundaries: readString(source.scope_boundaries),
    limitation_note: readString(source.limitation_note),
  };
}

// ---------------------------------------------------------------------------
// Scope statement
// ---------------------------------------------------------------------------

/**
 * The Scope & Guardrails statement. Each stored field becomes its own sentence,
 * so a workflow written as "The app walks the user through the flow." reads
 * correctly instead of producing "centered on the app walks the user...".
 */
export function composeScopeStatement(input: {
  projectTrack: ProjectTrack;
  seed: SoftwareSeed | ResearchSeed;
}): string {
  if (input.projectTrack === "research") {
    const seed = asResearchSeed(input.seed);
    return joinSentences(
      "Your scope is one question with one evidence path.",
      seed.research_question,
      seed.scope_boundaries,
      "Anything outside those boundaries waits until the core answer holds up.",
    );
  }

  const seed = asSoftwareSeed(input.seed);
  return joinSentences(
    "Your MVP is one workflow, start to finish.",
    seed.core_workflow,
    seed.mvp_boundary,
    "Anything outside that boundary waits until the core workflow works.",
  );
}

// ---------------------------------------------------------------------------
// Deferrals
// ---------------------------------------------------------------------------

/** Prefixes older rows carry, and the imperatives that read as "cut this now". */
const DEFERRAL_PREFIX = /^(?:stretch\s+later|later|stretch\s+goal|stretch)\s*[:\-–—]\s*/iu;
const CUT_IMPERATIVE =
  /^(?:remove|drop|cut|skip|delay|defer|postpone|avoid|deprioriti[sz]e|hold off on|leave out|omit)\s+/iu;

/** "Skip X and keep Y" — the continuation belongs to the imperative, not to X. */
const IMPERATIVE_CONTINUATION =
  /\s+and\s+(?:keep|prioriti[sz]e|focus|stay|stick|center|centre|leave|save|spend|make)\b.*$/iu;

/**
 * Rephrases one "cut if behind" item as a deferral. Existing rows may already
 * carry a "Stretch later:" prefix or lead with an imperative like "Drop ..."; both
 * read as an instruction to cut the item now rather than as something to revisit.
 */
export function toDeferral(item: string): string {
  const base = normalizeWhitespace(item);
  if (base.length === 0) return "";

  const withoutPrefix = base.replace(DEFERRAL_PREFIX, "").trim();
  const hadImperative = CUT_IMPERATIVE.test(withoutPrefix);
  let body = withoutPrefix.replace(CUT_IMPERATIVE, "").trim();

  if (hadImperative) {
    body = body.replace(IMPERATIVE_CONTINUATION, "").trim();
  }

  body = stripTerminalPunctuation(body);
  if (body.length === 0) return "";

  const phrase = asInlinePhrase(body);
  return `Later: ${asSentence(phrase ?? body)}`;
}

/** Rephrases every item, dropping any that reduce to nothing, and de-duplicates. */
export function toDeferralList(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const deferral = toDeferral(item);
    if (deferral.length === 0) continue;
    const key = deferral.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(deferral);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pitch kit
// ---------------------------------------------------------------------------

function softwareDraft(input: PitchKitSource): PitchKitContent {
  const seed = asSoftwareSeed(input.seed);
  // A project always has a title in practice; the untitled path keeps the draft
  // grammatical rather than emitting "Built This project, ...".
  const title = stripTerminalPunctuation(input.projectTitle);
  const subject = title || "This project";
  const rationale = usableRationale(input.whyItFits);
  const audience = asInlinePhrase(seed.target_user);
  const deliverable = asInlinePhrase(input.firstDeliverable ?? "");
  const stepCount = input.stepCount ?? 0;

  const elevatorPitch = joinSentences(
    `${subject} is a focused software project you can demo end to end.`,
    seed.problem_statement,
    seed.core_workflow,
    seed.validation_plan,
  );

  const builtObject = title ? `${title}, a focused tool` : "a focused tool";
  const builtBullet = audience
    ? `Built ${builtObject} for ${audience}.`
    : `Built ${builtObject} with one workflow that runs start to finish.`;

  const scopedBullet = deliverable
    ? stepCount > 0
      ? `Scoped the MVP to ${deliverable} and tracked progress across ${stepCount} planned steps.`
      : `Scoped the MVP to ${deliverable} and cut everything outside that boundary.`
    : `Scoped the MVP to one workflow and cut everything outside that boundary.`;

  const resumeBullets = [
    joinSentences(builtBullet, seed.core_workflow),
    scopedBullet,
  ].filter((bullet) => bullet.length > 0);

  const talkingPoints: PitchKitTalkingPoint[] = [
    {
      label: "Why this project",
      body:
        rationale ||
        joinSentences(
          "You picked a problem you can describe from experience.",
          seed.problem_statement,
        ),
    },
    {
      label: "What it does",
      body: joinSentences(
        seed.core_workflow,
        audience ? `It is built for ${audience}.` : "",
      ),
    },
    {
      label: "Why it matters",
      body: joinSentences(
        seed.problem_statement,
        "Fixing that one workflow is what makes the project worth showing.",
      ),
    },
  ].filter((point) => point.body.length > 0);

  return { elevatorPitch, resumeBullets, talkingPoints, isDraft: true };
}

function researchDraft(input: PitchKitSource): PitchKitContent {
  const seed = asResearchSeed(input.seed);
  const title = stripTerminalPunctuation(input.projectTitle);
  const subject = title || "This project";
  const rationale = usableRationale(input.whyItFits);
  const method = asInlinePhrase(seed.methodology);
  const deliverable = asInlinePhrase(input.firstDeliverable ?? "");
  const stepCount = input.stepCount ?? 0;

  const elevatorPitch = joinSentences(
    `${subject} is a student-scale research project with one question and one evidence path.`,
    seed.research_question,
    seed.hypothesis_or_focus,
    seed.evidence_plan,
  );

  const designedObject = title ? `${title}, a scoped research project` : "a scoped research project";
  const designedBullet = method
    ? `Designed and ran ${designedObject} using ${method}.`
    : `Designed and ran ${designedObject} with one defensible question.`;

  const scopedBullet = deliverable
    ? stepCount > 0
      ? `Built the evidence path from ${deliverable} through ${stepCount} planned steps, with limitations stated up front.`
      : `Built the evidence path from ${deliverable}, with limitations stated up front.`
    : `Built the evidence path end to end, with limitations stated up front.`;

  const resumeBullets = [
    joinSentences(designedBullet, seed.research_question),
    scopedBullet,
  ].filter((bullet) => bullet.length > 0);

  const talkingPoints: PitchKitTalkingPoint[] = [
    {
      label: "Why this project",
      body:
        rationale ||
        joinSentences(
          "You chose a question that is ambitious but still answerable with what you can access.",
          seed.hypothesis_or_focus,
        ),
    },
    {
      label: "What it investigates",
      body: joinSentences(
        seed.research_question,
        method ? `You answer it with ${method}.` : "",
      ),
    },
    {
      label: "What the evidence can and cannot show",
      body: joinSentences(seed.evidence_plan, seed.limitation_note),
    },
  ].filter((point) => point.body.length > 0);

  return { elevatorPitch, resumeBullets, talkingPoints, isDraft: true };
}

/** Composes the deterministic pitch kit draft for a project. */
export function composePitchKitDraft(input: PitchKitSource): PitchKitContent {
  return input.projectTrack === "research" ? researchDraft(input) : softwareDraft(input);
}

// ---------------------------------------------------------------------------
// Stored-content triage
// ---------------------------------------------------------------------------

/** Renders a talking point for storage and for the flat list view. */
export function formatTalkingPoint(point: PitchKitTalkingPoint): string {
  return labeledSentence(point.label, point.body);
}

/** Splits a stored "Label: body" talking point back into its parts. */
export function parseTalkingPoint(point: string): PitchKitTalkingPoint | null {
  const match = normalizeWhitespace(point).match(/^([^:]{3,40}):\s*(.+)$/u);
  if (!match) return null;
  return { label: match[1].trim(), body: match[2].trim() };
}

/**
 * True when a stored string is clean enough to show as written. Stored copy that
 * fails is recomposed from the structured fields rather than shown as-is, which
 * repairs rows written before this module existed without touching the database.
 */
export function isUsableStoredCopy(value: string | null | undefined): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  return lintProse(value).length === 0;
}

/** True when every stored string in the list is clean, and the list is non-empty. */
export function isUsableStoredCopyList(values: readonly string[] | null | undefined): boolean {
  if (!values || values.length === 0) return false;
  return values.every((value) => isUsableStoredCopy(value));
}
