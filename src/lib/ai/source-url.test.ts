import assert from "node:assert/strict";
import test from "node:test";
import { canonicalSourceUrl } from "./source-url.ts";

// Roadmap generation validates every learning-resource URL against the source
// list returned by web search (see runRoadmapGeneration in pipelines.ts). If
// canonicalization collapses two distinct resources into one string, a URL the
// model invented can match an unrelated citation and pass validation.

test("source URL canonicalization preserves content queries and removes known tracking", () => {
  const firstVideo = canonicalSourceUrl("https://www.youtube.com/watch?v=one");
  const secondVideo = canonicalSourceUrl("https://www.youtube.com/watch?v=two");

  assert.notEqual(firstVideo, secondVideo, "distinct query-addressed resources must stay distinct");
  assert.equal(
    canonicalSourceUrl(
      "https://www.youtube.com/watch?utm_source=newsletter&v=one&utm_campaign=launch",
    ),
    firstVideo,
    "recognized tracking parameters should not prevent an evidence match",
  );
  assert.equal(
    canonicalSourceUrl("https://example.com/guide?language=en&chapter=2"),
    canonicalSourceUrl("https://example.com/guide?chapter=2&language=en"),
    "query ordering alone should not create distinct resources",
  );
  assert.notEqual(
    canonicalSourceUrl("https://www.youtube.com/watch?v=guessed"),
    firstVideo,
    "a guessed content identifier must not match a different cited resource",
  );
});

test("canonicalization strips only the recognized tracking parameters", () => {
  // Every parameter here is on the tracking list and must disappear.
  assert.equal(
    canonicalSourceUrl(
      "https://example.com/post?utm_source=x&utm_medium=y&utm_campaign=z&utm_term=t&utm_content=c&utm_id=i&gclid=g&fbclid=f&dclid=d&igshid=ig&mc_cid=m&mc_eid=e&msclkid=ms",
    ),
    "https://example.com/post",
  );

  // Unrecognized parameters are content-bearing until proven otherwise.
  assert.equal(
    canonicalSourceUrl("https://example.com/post?ref=partner"),
    "https://example.com/post?ref=partner",
  );
});

test("tracking parameter matching is case-insensitive", () => {
  assert.equal(
    canonicalSourceUrl("https://example.com/post?UTM_Source=newsletter"),
    "https://example.com/post",
  );
});

test("canonicalization normalizes trailing slashes without emptying the path", () => {
  assert.equal(
    canonicalSourceUrl("https://example.com/docs/guide/"),
    canonicalSourceUrl("https://example.com/docs/guide"),
  );
  assert.equal(canonicalSourceUrl("https://example.com/"), "https://example.com/");
  assert.equal(canonicalSourceUrl("https://example.com"), "https://example.com/");
});

test("host and protocol remain part of the identity", () => {
  assert.notEqual(
    canonicalSourceUrl("https://example.com/guide"),
    canonicalSourceUrl("http://example.com/guide"),
  );
  assert.notEqual(
    canonicalSourceUrl("https://example.com/guide"),
    canonicalSourceUrl("https://docs.example.com/guide"),
  );
});

test("unparseable values pass through unchanged rather than collapsing together", () => {
  assert.equal(canonicalSourceUrl("not a real URL"), "not a real URL");
  assert.notEqual(canonicalSourceUrl("not a real URL"), canonicalSourceUrl("also not a URL"));
  assert.equal(canonicalSourceUrl(""), "");
});
