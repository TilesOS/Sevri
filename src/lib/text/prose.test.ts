import assert from "node:assert/strict";
import test from "node:test";
import {
  asInlinePhrase,
  asSentence,
  joinSentences,
  labeledSentence,
  normalizeWhitespace,
  sentenceCount,
  stripTerminalPunctuation,
  stripZeroWidth,
} from "./prose.ts";

test("asSentence capitalizes and closes an unterminated field", () => {
  assert.equal(asSentence("build one comparison view"), "Build one comparison view.");
});

test("asSentence leaves a question mark alone", () => {
  assert.equal(
    asSentence("What drives loss in silicon waveguides?"),
    "What drives loss in silicon waveguides?",
  );
});

test("asSentence sheds a dangling connector character before closing", () => {
  assert.equal(asSentence("Load the sweep, compare, and save,"), "Load the sweep, compare, and save.");
});

test("asSentence handles empty and non-string input", () => {
  assert.equal(asSentence(""), "");
  assert.equal(asSentence(null), "");
  assert.equal(asSentence(undefined), "");
});

test("asInlinePhrase lowercases an ordinary leading word", () => {
  assert.equal(asInlinePhrase("Students validating experiments"), "students validating experiments");
});

test("asInlinePhrase preserves acronyms and proper nouns", () => {
  assert.equal(asInlinePhrase("API traces from the parser"), "API traces from the parser");
  assert.equal(asInlinePhrase("TypeScript build output"), "TypeScript build output");
});

test("asInlinePhrase refuses multi-sentence input", () => {
  assert.equal(asInlinePhrase("One sentence. Then another one."), null);
});

test("asInlinePhrase refuses input longer than the inline budget", () => {
  assert.equal(asInlinePhrase("word ".repeat(30).trim()), null);
});

test("asInlinePhrase drops trailing punctuation", () => {
  assert.equal(asInlinePhrase("A one-page scope brief."), "a one-page scope brief");
});

test("joinSentences skips empty parts and terminates each one", () => {
  assert.equal(
    joinSentences("first part", "", null, "second part"),
    "First part. Second part.",
  );
});

test("labeledSentence keeps the body as its own sentence", () => {
  assert.equal(
    labeledSentence("What it does", "the tool ranks hotspots"),
    "What it does: The tool ranks hotspots.",
  );
});

test("stripZeroWidth removes invisible characters", () => {
  assert.equal(stripZeroWidth("study\u200B\uFEFF"), "study");
});

test("normalizeWhitespace collapses runs and strips zero-width", () => {
  assert.equal(normalizeWhitespace("  a \n b\u200B  "), "a b");
});

test("stripTerminalPunctuation removes trailing stops and commas", () => {
  assert.equal(stripTerminalPunctuation("A scope brief.,"), "A scope brief");
});

test("sentenceCount counts terminated sentences", () => {
  assert.equal(sentenceCount(""), 0);
  assert.equal(sentenceCount("No stop here"), 1);
  assert.equal(sentenceCount("One. Two."), 2);
});
