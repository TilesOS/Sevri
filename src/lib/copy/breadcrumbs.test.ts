import assert from "node:assert/strict";
import test from "node:test";
import { extractProjectId, getHeaderBreadcrumbs } from "./breadcrumbs.ts";
import { PROJECT_SECTION_LABELS, WORKSPACE_LABELS } from "./glossary.ts";

const PROJECT_ID = "3f2a";
const PROJECT_TITLE = "Silicon photonics benchmark";

function mobileLabels(pathname: string, projectTitle: string | null = PROJECT_TITLE) {
  return getHeaderBreadcrumbs(pathname, projectTitle)
    .filter((crumb) => crumb.showOnMobile)
    .map((crumb) => crumb.label);
}

test("project ids come only from the canonical /project/ prefix", () => {
  assert.equal(extractProjectId(`/project/${PROJECT_ID}`), PROJECT_ID);
  assert.equal(extractProjectId(`/project/${PROJECT_ID}/steps/4`), PROJECT_ID);
  assert.equal(extractProjectId("/projects/3f2a/focus"), null);
  assert.equal(extractProjectId("/dashboard"), null);
  assert.equal(extractProjectId("/project"), null);
});

// DES-022: on a step page the mobile trail collapsed to "Dashboard", so a
// student on a phone could not tell which project or step they were reading.
test("narrow screens keep the project and the step, not just Dashboard", () => {
  assert.deepEqual(mobileLabels(`/project/${PROJECT_ID}/steps/4`), [PROJECT_TITLE, "Step 4"]);
});

test("the full trail still starts at Dashboard on wider screens", () => {
  const crumbs = getHeaderBreadcrumbs(`/project/${PROJECT_ID}/steps/4`, PROJECT_TITLE);

  assert.deepEqual(
    crumbs.map((crumb) => crumb.label),
    [WORKSPACE_LABELS.dashboard, PROJECT_TITLE, "Step 4"],
  );
  assert.equal(crumbs[0].showOnMobile, false);
});

test("an unloaded project title still names the kind of page", () => {
  assert.deepEqual(mobileLabels(`/project/${PROJECT_ID}/scope`, null), [
    WORKSPACE_LABELS.projectWorkspace,
    PROJECT_SECTION_LABELS.scope,
  ]);
});

// DES-011: the breadcrumb said "Scope", "Research lens", and "Pitch kit" while
// the sidebar said something else for each.
test("section crumbs use the shared glossary labels", () => {
  const sections: Array<[string, string]> = [
    ["scope", PROJECT_SECTION_LABELS.scope],
    ["lens", PROJECT_SECTION_LABELS.lens],
    ["pitch-kit", PROJECT_SECTION_LABELS.pitchKit],
    ["focus", PROJECT_SECTION_LABELS.focus],
  ];

  for (const [segment, label] of sections) {
    const crumbs = getHeaderBreadcrumbs(`/project/${PROJECT_ID}/${segment}`, PROJECT_TITLE);
    assert.equal(crumbs.at(-1)?.label, label, `${segment} should read "${label}"`);
    assert.equal(crumbs.at(-1)?.href, `/project/${PROJECT_ID}/${segment}`);
  }
});

test("the lens section is not called research on either track", () => {
  const crumbs = getHeaderBreadcrumbs(`/project/${PROJECT_ID}/lens`, PROJECT_TITLE);
  assert.ok(!/research/i.test(crumbs.at(-1)?.label ?? ""));
});

test("the project overview has no trailing section crumb", () => {
  assert.deepEqual(mobileLabels(`/project/${PROJECT_ID}`), [PROJECT_TITLE]);
});

test("workspace routes end on their own label", () => {
  assert.deepEqual(mobileLabels("/recommendations"), [WORKSPACE_LABELS.ideas]);
  assert.deepEqual(mobileLabels("/calendar"), [WORKSPACE_LABELS.calendar]);
  assert.deepEqual(mobileLabels("/portfolio"), [WORKSPACE_LABELS.portfolio]);
  assert.deepEqual(mobileLabels("/settings"), [WORKSPACE_LABELS.settings]);
  assert.deepEqual(mobileLabels("/settings/billing"), [WORKSPACE_LABELS.billing]);
  assert.deepEqual(mobileLabels("/settings/integrations"), [WORKSPACE_LABELS.integrations]);
});

test("the dashboard is a single crumb", () => {
  const crumbs = getHeaderBreadcrumbs("/dashboard", null);

  assert.equal(crumbs.length, 1);
  assert.equal(crumbs[0].label, WORKSPACE_LABELS.dashboard);
  assert.equal(crumbs[0].showOnMobile, true);
});

test("the last crumb is always visible on mobile", () => {
  const paths = [
    "/dashboard",
    "/calendar",
    "/portfolio",
    "/settings/billing",
    `/project/${PROJECT_ID}`,
    `/project/${PROJECT_ID}/steps/1`,
    `/project/${PROJECT_ID}/pitch-kit`,
  ];

  for (const path of paths) {
    const crumbs = getHeaderBreadcrumbs(path, PROJECT_TITLE);
    assert.equal(crumbs.at(-1)?.showOnMobile, true, `${path} must keep its final crumb on mobile`);
  }
});
