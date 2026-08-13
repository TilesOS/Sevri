import assert from "node:assert/strict";
import test from "node:test";
import { lintProse } from "./content-lint.ts";
import { needsStudentVoice, toStudentVoice } from "./student-voice.ts";

test("rewrites a third-person subject into second person with verb agreement", () => {
  assert.equal(
    toStudentVoice("The student can handle a structured method if the scope stays narrow."),
    "You can handle a structured method if the scope stays narrow.",
  );
  assert.equal(
    toStudentVoice("The student has a photonics background."),
    "You have a photonics background.",
  );
});

test("rewrites the possessive form", () => {
  assert.equal(
    toStudentVoice("The student's background gives them a reason to own this problem."),
    "Your background gives you a reason to own this problem.",
  );
});

test("rewrites trailing third-person pronouns once the reader is identified", () => {
  assert.equal(
    toStudentVoice("It gives the student a question they can defend with their own evidence."),
    "It gives you a question you can defend with your own evidence.",
  );
});

test("leaves third-person pronouns alone when they refer to someone else", () => {
  const aboutUsers = "Engineers compare two runs by hand, and their notes go stale quickly.";
  assert.equal(toStudentVoice(aboutUsers), aboutUsers);
});

test("replaces internal profile vocabulary", () => {
  assert.equal(
    toStudentVoice("This project directly addresses Sevri's target outcome."),
    "This project directly addresses your goal.",
  );
});

test("rewritten copy passes the content lint", () => {
  const rewritten = toStudentVoice(
    "The strongest project anchors are photonics and optics. The student can defend the method.",
  );
  assert.deepEqual(lintProse(rewritten), []);
});

test("leaves copy that is already in second person untouched", () => {
  const clean = "Your strongest anchors are photonics and optics. Keep the question narrow.";
  assert.equal(toStudentVoice(clean), clean);
  assert.equal(needsStudentVoice(clean), false);
});

test("needsStudentVoice detects copy that would change", () => {
  assert.equal(needsStudentVoice("The student can defend the method."), true);
  assert.equal(needsStudentVoice(""), false);
  assert.equal(needsStudentVoice(null), false);
});

test("recapitalizes sentence starts after rewriting", () => {
  assert.equal(
    toStudentVoice("the student will ship one workflow. the student can demo it."),
    "You will ship one workflow. You can demo it.",
  );
});
