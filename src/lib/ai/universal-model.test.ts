import assert from "node:assert/strict";
import test from "node:test";
import { zodTextFormat } from "openai/helpers/zod";
import { GenerationContextSchema, ProjectBlueprintSchema, RecommendationBatchSchema } from "./schemas.ts";

type JsonSchemaNode = {
  format?: string;
  items?: JsonSchemaNode;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
};

for (const preferredFormats of [["digital"], ["physical"], ["creative"], ["investigative"], ["community", "physical"], ["venture", "digital"]] as const) {
  test(`universal context accepts ${preferredFormats.join("+")} work`, () => {
    const context = GenerationContextSchema.parse({ summary: "A student wants a concrete, finishable project grounded in a real interest.", interpreted_interests: ["water access"], skill_assessment: "beginner", risk_flags: [], project_context_json: { domain_brief: "Water access and public communication provide the strongest project anchors.", anchor_interests: ["water access"], goal_signal: "Create a finished artifact that demonstrates learning and care.", success_definition: "A reviewer can inspect the artifact and the evidence behind it.", resource_snapshot: "A library, a laptop, and five hours each week.", preferred_formats: preferredFormats, open_to_anything: false, existing_skills: [], field_practices: ["Document sources and decisions"], scope_risks: ["Keep one central challenge"], safety_ethics_considerations: ["Protect participant privacy when relevant"], anti_generic_warnings: ["Do not default to a generic app", "Use concrete artifacts"], scope_guardrails: ["Keep one audience", "Use one evidence loop"], focus_signal: "Finish the smallest complete artifact first.", project_goal: "learning", constraints_summary: "Five hours each week.", weekly_hours: 5, completion_date: null, preferred_challenge: "intermediate" } });
    assert.deepEqual(context.project_context_json.preferred_formats, preferredFormats);
  });
}
test("the shared blueprint requires artifacts and proof", () => assert.ok(ProjectBlueprintSchema.parse({ central_challenge: "Understand a concrete local problem through a finishable project.", approach: "Create, test, and document one focused response.", primary_artifacts: ["Core artifact"], proof_of_success: ["A reviewer can inspect it", "The student can explain the choices"], scope_boundary: "One audience and one proof loop.", resources_needed: ["Student-accessible tools"], safety_ethics_notes: [] })));
test("the comparison board retains three increasing ambition levels", () => {
  const base = { title: "Water Story", summary: "Create a focused artifact about local water access with a clear audience and reviewable evidence.", why_it_fits: "This uses the student's interests and available resources without exceeding the weekly schedule.", project_kind_label: "Community storytelling project", repository_relevance: "not_needed", estimated_weeks: 6, skills_demonstrated: ["communication", "project scoping"], tools_needed: ["recorder", "audio editor"], finishability_score: 9, project_blueprint_json: { central_challenge: "Explain one local water-access issue through a finished public artifact.", approach: "Gather a small body of evidence, create the artifact, and test it with its intended audience.", primary_artifacts: ["Finished story"], proof_of_success: ["Three readers can identify the central finding", "The source log supports every public claim"], scope_boundary: "One neighborhood and one story format.", resources_needed: ["Library sources"], safety_ethics_notes: ["Use consent for interviews"] }, grounding_sources: [] };
  const parsed = RecommendationBatchSchema.parse({ recommendations: [{ ...base, id: "focused", difficulty: "beginner", impressiveness_score: 6 }, { ...base, id: "stretch", difficulty: "intermediate", impressiveness_score: 8 }, { ...base, id: "ambitious", difficulty: "advanced", impressiveness_score: 10 }] });
  assert.deepEqual(parsed.recommendations.map((item) => item.difficulty), ["beginner", "intermediate", "advanced"]);
});

test("the recommendation schema is accepted by OpenAI structured outputs", () => {
  const schema = zodTextFormat(RecommendationBatchSchema, "universal_project_options").schema as JsonSchemaNode;
  const recommendation = schema.properties?.recommendations?.items;
  const groundingSource = recommendation?.properties?.grounding_sources?.items;

  assert.ok(recommendation?.required?.includes("grounding_sources"));
  assert.notEqual(groundingSource?.properties?.url?.format, "uri");
});
