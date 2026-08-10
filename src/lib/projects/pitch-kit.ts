import { lintProse } from "../text/content-lint.ts";
import { asInlinePhrase, asSentence, joinSentences, labeledSentence, normalizeWhitespace, stripTerminalPunctuation } from "../text/prose.ts";
import { toStudentVoice } from "../text/student-voice.ts";

export interface PitchKitTalkingPoint { label: string; body: string }
export interface PitchKitContent {
  elevatorPitch: string;
  resumeBullets: string[];
  talkingPoints: PitchKitTalkingPoint[];
  isDraft: boolean;
}

export interface ProjectBlueprintSeed {
  central_challenge?: unknown;
  approach?: unknown;
  primary_artifacts?: unknown;
  proof_of_success?: unknown;
  scope_boundary?: unknown;
  resources_needed?: unknown;
}

export interface PitchKitSource {
  projectTitle: string;
  seed: ProjectBlueprintSeed;
  firstDeliverable?: string | null;
  stepCount?: number;
  whyItFits?: string | null;
}

function read(value: unknown) { return typeof value === "string" ? normalizeWhitespace(value) : ""; }
function readList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []; }

export function composeScopeStatement(input: { seed: ProjectBlueprintSeed }): string {
  return joinSentences(
    "Your core scope protects one central challenge and its proof loop.",
    read(input.seed.central_challenge),
    read(input.seed.scope_boundary),
    "Anything outside that boundary waits until the primary artifacts are complete.",
  );
}

const DEFERRAL_PREFIX = /^(?:stretch\s+later|later|stretch\s+goal|stretch)\s*[:\-–—]\s*/iu;
const CUT_IMPERATIVE = /^(?:remove|drop|cut|skip|delay|defer|postpone|avoid|deprioriti[sz]e|hold off on|leave out|omit)\s+/iu;
const IMPERATIVE_CONTINUATION = /\s+and\s+(?:keep|prioriti[sz]e|focus|stay|stick|center|centre|leave|save|spend|make)\b.*$/iu;

export function toDeferral(item: string): string {
  const base = normalizeWhitespace(item);
  if (!base) return "";
  const withoutPrefix = base.replace(DEFERRAL_PREFIX, "").trim();
  const hadImperative = CUT_IMPERATIVE.test(withoutPrefix);
  let body = withoutPrefix.replace(CUT_IMPERATIVE, "").trim();
  if (hadImperative) body = body.replace(IMPERATIVE_CONTINUATION, "").trim();
  body = stripTerminalPunctuation(body);
  if (!body) return "";
  return `Later: ${asSentence(asInlinePhrase(body) ?? body)}`;
}

export function toDeferralList(items: readonly string[]): string[] {
  return Array.from(new Set(items.map(toDeferral).filter(Boolean)));
}

function usableRationale(value: string | null | undefined) {
  if (!value?.trim()) return "";
  const sentence = asSentence(toStudentVoice(value));
  return lintProse(sentence).length === 0 ? sentence : "";
}

export function composePitchKitDraft(input: PitchKitSource): PitchKitContent {
  const title = stripTerminalPunctuation(input.projectTitle) || "This project";
  const challenge = read(input.seed.central_challenge);
  const approach = read(input.seed.approach);
  const boundary = read(input.seed.scope_boundary);
  const artifacts = readList(input.seed.primary_artifacts);
  const proof = readList(input.seed.proof_of_success);
  const firstArtifact = asInlinePhrase(artifacts[0] ?? input.firstDeliverable ?? "");
  const rationale = usableRationale(input.whyItFits);
  const elevatorPitch = joinSentences(
    `${title} is a focused project with a concrete artifact and an observable proof of success.`,
    challenge,
    approach,
    proof[0],
  );
  const resumeBullets = [
    firstArtifact ? `Created ${firstArtifact} and documented the decisions behind it.` : `Created the primary artifact for ${title} and documented the decisions behind it.`,
    joinSentences(`Scoped the work across ${input.stepCount ?? 0} planned steps.`, boundary),
  ];
  const talkingPoints = [
    { label: "Why this project", body: rationale || joinSentences("You chose one meaningful challenge you could finish.", challenge) },
    { label: "What you made", body: joinSentences(artifacts[0] ?? "You made the primary project artifact.", approach) },
    { label: "What proves it", body: joinSentences(...proof) || "You can point to a finished artifact and explain what it demonstrates." },
  ];
  return { elevatorPitch, resumeBullets, talkingPoints, isDraft: true };
}

export function formatTalkingPoint(point: PitchKitTalkingPoint): string { return labeledSentence(point.label, point.body); }
export function parseTalkingPoint(point: string): PitchKitTalkingPoint | null {
  const match = normalizeWhitespace(point).match(/^([^:]{3,40}):\s*(.+)$/u);
  return match ? { label: match[1].trim(), body: match[2].trim() } : null;
}
export function isUsableStoredCopy(value: string | null | undefined): boolean { return typeof value === "string" && value.trim().length > 0 && lintProse(value).length === 0; }
export function isUsableStoredCopyList(values: readonly string[] | null | undefined): boolean { return Boolean(values?.length) && values!.every(isUsableStoredCopy); }
