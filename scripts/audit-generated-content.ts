/**
 * Report stored generated content that looks truncated, contaminated, or
 * template-stitched.
 *
 * Usage:
 *   npm run audit:content                  # summary counts per table and field
 *   npm run audit:content -- --verbose     # one line per affected row
 *   npm run audit:content -- --json        # machine-readable report
 *   npm run audit:content -- --limit 500   # rows to scan per table (default 1000)
 *
 * Read-only. It never writes and never regenerates: regeneration costs quota, so
 * the decision of what to regenerate stays with the owner. Row ids are printed so
 * a follow-up can target specific rows.
 */

import { checkField, type FieldSpec, type QualityIssue } from "../src/lib/ai/content-quality";
import { lintProse } from "../src/lib/text/content-lint";
import { createAdminSupabaseClient } from "../src/lib/supabase/admin";

interface Args {
  verbose: boolean;
  json: boolean;
  limit: number;
}

function parseArgs(argv: string[]): Args {
  const limitIndex = argv.indexOf("--limit");
  const rawLimit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : NaN;

  return {
    verbose: argv.includes("--verbose"),
    json: argv.includes("--json"),
    limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 1000,
  };
}

interface Finding {
  table: string;
  rowId: string;
  field: string;
  issues: string[];
  snippet: string;
}

const TITLE_SPEC: FieldSpec = { kind: "title", minCredible: 8, maxUiSafe: 120 };
const PROSE_SPEC: FieldSpec = { kind: "prose", minCredible: 24 };
const BULLET_SPEC: FieldSpec = { kind: "bullet", minCredible: 16 };

/** Field kinds map to how the string is presented, which decides which rules apply. */
type FieldKind = "title" | "prose" | "bullet";

const SPEC_BY_KIND: Record<FieldKind, FieldSpec> = {
  title: TITLE_SPEC,
  prose: PROSE_SPEC,
  bullet: BULLET_SPEC,
};

function inspect(value: unknown, kind: FieldKind): string[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const quality: QualityIssue[] = checkField(value, "field", SPEC_BY_KIND[kind]);
  const lint = lintProse(value, { requireTerminalPunctuation: kind !== "title" });

  const codes = [
    ...quality
      // A title's UI budget is a layout concern, not a content defect.
      .filter((issue) => issue.kind !== "too_long_title")
      .map((issue) => issue.kind),
    ...lint.map((issue) => issue.code),
  ];

  return Array.from(new Set(codes));
}

function snippetOf(value: string): string {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed.length <= 110 ? collapsed : `${collapsed.slice(0, 60)} … ${collapsed.slice(-45)}`;
}

function record(
  findings: Finding[],
  table: string,
  rowId: string,
  field: string,
  value: unknown,
  kind: FieldKind,
): void {
  const issues = inspect(value, kind);
  if (issues.length === 0) return;
  findings.push({ table, rowId, field, issues, snippet: snippetOf(String(value)) });
}

function recordList(
  findings: Finding[],
  table: string,
  rowId: string,
  field: string,
  value: unknown,
  kind: FieldKind,
): void {
  if (!Array.isArray(value)) return;
  value.forEach((item, index) => record(findings, table, rowId, `${field}[${index}]`, item, kind));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function auditRecommendations(limit: number): Promise<Finding[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("project_recommendations")
    .select("id, title, summary, rationale, authenticity_note, project_blueprint_json")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`project_recommendations: ${error.message}`);

  const findings: Finding[] = [];
  for (const row of data ?? []) {
    record(findings, "project_recommendations", row.id, "title", row.title, "title");
    record(findings, "project_recommendations", row.id, "summary", row.summary, "prose");
    record(findings, "project_recommendations", row.id, "rationale", row.rationale, "prose");
    record(
      findings,
      "project_recommendations",
      row.id,
      "authenticity_note",
      row.authenticity_note,
      "prose",
    );

    const seed = asRecord(row.project_blueprint_json);
    for (const key of Object.keys(seed)) {
      record(findings, "project_recommendations", row.id, `seed.${key}`, seed[key], "prose");
    }
  }

  return findings;
}

async function auditProjects(limit: number): Promise<Finding[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`projects: ${error.message}`);

  const findings: Finding[] = [];
  for (const row of data ?? []) {
    record(findings, "projects", row.id, "title", row.title, "title");
  }
  return findings;
}

async function auditRoadmaps(limit: number): Promise<Finding[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("project_roadmaps")
    .select("id, overview, core_scope, stretch_goals, explanation_guide, roadmap_context_json")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`project_roadmaps: ${error.message}`);

  const findings: Finding[] = [];
  for (const row of data ?? []) {
    record(findings, "project_roadmaps", row.id, "overview", row.overview, "prose");
    record(findings, "project_roadmaps", row.id, "core_scope", row.core_scope, "prose");
    recordList(findings, "project_roadmaps", row.id, "stretch_goals", row.stretch_goals, "bullet");

    const guide = asRecord(row.explanation_guide);
    record(findings, "project_roadmaps", row.id, "elevator_pitch", guide.elevator_pitch, "prose");
    recordList(findings, "project_roadmaps", row.id, "resume_bullets", guide.resume_bullets, "bullet");
    recordList(
      findings,
      "project_roadmaps",
      row.id,
      "interview_talking_points",
      guide.interview_talking_points,
      "prose",
    );

    const payload = asRecord(row.roadmap_context_json);
    record(findings, "project_roadmaps", row.id, "project_brief", payload.project_brief, "prose");
    recordList(findings, "project_roadmaps", row.id, "cut_if_behind", payload.cut_if_behind, "bullet");
    recordList(
      findings,
      "project_roadmaps",
      row.id,
      "success_criteria",
      payload.success_criteria,
      "bullet",
    );
  }

  return findings;
}

async function auditMilestones(limit: number): Promise<Finding[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("id, title, objective, deliverable")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`milestones: ${error.message}`);

  const findings: Finding[] = [];
  for (const row of data ?? []) {
    record(findings, "milestones", row.id, "title", row.title, "title");
    record(findings, "milestones", row.id, "objective", row.objective, "prose");
    record(findings, "milestones", row.id, "deliverable", row.deliverable, "prose");
  }
  return findings;
}

async function auditMilestoneGuidance(limit: number): Promise<Finding[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("milestone_guidance")
    .select("id, guidance_json")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`milestone_guidance: ${error.message}`);

  const findings: Finding[] = [];
  for (const row of data ?? []) {
    const guidance = asRecord(row.guidance_json);
    record(findings, "milestone_guidance", row.id, "what_to_do_now", guidance.what_to_do_now, "prose");
    record(findings, "milestone_guidance", row.id, "encouragement", guidance.encouragement, "prose");
    recordList(findings, "milestone_guidance", row.id, "checklist", guidance.checklist, "bullet");
    recordList(findings, "milestone_guidance", row.id, "pitfalls", guidance.pitfalls, "bullet");
    recordList(findings, "milestone_guidance", row.id, "done_when", guidance.done_when, "bullet");
  }
  return findings;
}

async function auditNormalizedProfiles(limit: number): Promise<Finding[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("normalized_profiles")
    .select("id, summary, project_context_json")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`normalized_profiles: ${error.message}`);

  const findings: Finding[] = [];
  for (const row of data ?? []) {
    record(findings, "normalized_profiles", row.id, "summary", row.summary, "prose");
    const payload = asRecord(row.project_context_json);
    record(
      findings,
      "normalized_profiles",
      row.id,
      "constraints_summary",
      payload.constraints_summary,
      "prose",
    );
    record(findings, "normalized_profiles", row.id, "domain_brief", payload.domain_brief, "prose");
  }
  return findings;
}

async function auditPortfolioEntries(limit: number): Promise<Finding[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("portfolio_entries")
    .select("id, curated_summary")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    // The table is optional in older environments; report rather than fail the run.
    console.warn(`portfolio_entries skipped: ${error.message}`);
    return [];
  }

  const findings: Finding[] = [];
  for (const row of data ?? []) {
    record(findings, "portfolio_entries", row.id, "curated_summary", row.curated_summary, "prose");
  }
  return findings;
}

function summarize(findings: Finding[]) {
  const byTableField = new Map<string, { rows: Set<string>; issues: Map<string, number> }>();

  for (const finding of findings) {
    const key = `${finding.table}.${finding.field.replace(/\[\d+\]/gu, "[]")}`;
    const bucket = byTableField.get(key) ?? { rows: new Set<string>(), issues: new Map() };
    bucket.rows.add(finding.rowId);
    for (const issue of finding.issues) {
      bucket.issues.set(issue, (bucket.issues.get(issue) ?? 0) + 1);
    }
    byTableField.set(key, bucket);
  }

  return Array.from(byTableField.entries())
    .map(([key, bucket]) => ({
      field: key,
      affectedRows: bucket.rows.size,
      issues: Object.fromEntries(
        Array.from(bucket.issues.entries()).sort((a, b) => b[1] - a[1]),
      ),
    }))
    .sort((a, b) => b.affectedRows - a.affectedRows);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const findings = (
    await Promise.all([
      auditRecommendations(args.limit),
      auditProjects(args.limit),
      auditRoadmaps(args.limit),
      auditMilestones(args.limit),
      auditMilestoneGuidance(args.limit),
      auditNormalizedProfiles(args.limit),
      auditPortfolioEntries(args.limit),
    ])
  ).flat();

  const summary = summarize(findings);
  const affectedRowsByTable = new Map<string, Set<string>>();
  for (const finding of findings) {
    const rows = affectedRowsByTable.get(finding.table) ?? new Set<string>();
    rows.add(finding.rowId);
    affectedRowsByTable.set(finding.table, rows);
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          scanned_limit_per_table: args.limit,
          total_findings: findings.length,
          affected_rows_by_table: Object.fromEntries(
            Array.from(affectedRowsByTable.entries()).map(([table, rows]) => [table, rows.size]),
          ),
          summary,
          findings,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Scanned up to ${args.limit} rows per table.`);
  console.log(`Found ${findings.length} flagged fields.\n`);

  if (findings.length === 0) {
    console.log("No stored generated content matched the truncation or stitching heuristics.");
    return;
  }

  console.log("Affected rows by table:");
  for (const [table, rows] of affectedRowsByTable) {
    console.log(`  ${table}: ${rows.size}`);
  }

  console.log("\nBy field:");
  for (const entry of summary) {
    const issues = Object.entries(entry.issues)
      .map(([code, count]) => `${code}×${count}`)
      .join(", ");
    console.log(`  ${entry.field} — ${entry.affectedRows} rows — ${issues}`);
  }

  if (args.verbose) {
    console.log("\nRows:");
    for (const finding of findings) {
      console.log(
        `  ${finding.table} ${finding.rowId} ${finding.field} [${finding.issues.join(", ")}]\n    ${finding.snippet}`,
      );
    }
  } else {
    console.log("\nRe-run with --verbose to list row ids and snippets.");
  }

  console.log(
    "\nNothing was modified. Regeneration consumes generation quota, so choose which rows to regenerate before acting on this report.",
  );
}

main().catch((error) => {
  console.error("audit-generated-content failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
