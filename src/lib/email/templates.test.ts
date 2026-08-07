import assert from "node:assert/strict";
import test from "node:test";
import { coachEmailTemplate, roadmapReadyTemplate, welcomeEmailTemplate } from "./templates.ts";

test("transactional templates escape user-controlled values", () => {
  const welcome = welcomeEmailTemplate('<img src=x onerror="alert(1)">', "https://sevri.co");
  const roadmap = roadmapReadyTemplate("A & <B>", "https://sevri.co", "project-id");
  assert.doesNotMatch(welcome.html, /<img src=x/);
  assert.match(welcome.html, /&lt;img/);
  assert.match(roadmap.html, /A &amp; &lt;B&gt;/);
});

test("coach templates include compliance footer and escape curated content", () => {
  const result = coachEmailTemplate({
    day: 7,
    projectTitle: "Safe project",
    projectId: "project-id",
    curatedBody: "Try <script>alert(1)</script>",
    curatedSubject: "A useful\r\nnext step",
    siteUrl: "https://sevri.co",
    footer: { postalAddress: "123 Main St", unsubscribeUrl: "https://sevri.co/u?t=1&x=2" },
  });
  assert.doesNotMatch(result.html, /<script>/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.html, /123 Main St/);
  assert.match(result.text, /Unsubscribe:/);
  assert.equal(result.subject, "A useful next step");
});
