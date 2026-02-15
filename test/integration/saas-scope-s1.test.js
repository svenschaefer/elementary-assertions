const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

function mentionSurface(doc, mentionId) {
  const mentions = new Map((doc.mentions || []).map((m) => [m.id, m]));
  const tokens = new Map((doc.tokens || []).map((t) => [t.id, t]));
  const mention = mentions.get(mentionId);
  if (!mention) return "";
  return (mention.token_ids || [])
    .map((tokenId) => tokens.get(tokenId))
    .filter(Boolean)
    .sort((a, b) => a.i - b.i)
    .map((t) => t.surface)
    .join(" ");
}

test("saas s1 emits centered with Organization location after upstream 1.1.35 acceptance update", () => {
  const inPath = path.resolve(
    __dirname,
    "..",
    "artifacts",
    "saas",
    "result-reference",
    "seed.elementary-assertions.yaml"
  );
  const doc = yaml.load(fs.readFileSync(inPath, "utf8"));

  const s1Assertions = (doc.assertions || []).filter((a) => a.segment_id === "s1");
  assert.equal(s1Assertions.length, 1);
  const centered = s1Assertions[0];
  assert.equal(mentionSurface(doc, centered.predicate.mention_id), "centered");

  const actorEntries = (centered.arguments || []).filter((entry) => entry.role === "actor");
  assert.equal(actorEntries.length, 0);

  const themeMentions = (centered.arguments || [])
    .filter((entry) => entry.role === "theme")
    .flatMap((entry) => entry.mention_ids || [])
    .map((mentionId) => mentionSurface(doc, mentionId));
  assert.ok(themeMentions.some((text) => text.includes("classic SaaS system")));
  assert.ok(!themeMentions.some((text) => text.includes("Organization")));

  const locationMentions = (centered.arguments || [])
    .filter((entry) => entry.role === "location")
    .flatMap((entry) => entry.mention_ids || [])
    .map((mentionId) => mentionSurface(doc, mentionId));
  assert.ok(locationMentions.includes("Organization"));

  const s1Unresolved = ((doc.coverage || {}).unresolved || [])
    .filter((u) => u.segment_id === "s1")
    .map((u) => mentionSurface(doc, u.mention_id));
  assert.ok(!s1Unresolved.includes("Organization"));
  assert.ok(s1Unresolved.includes("primary tenant scope"));
});

test("sentence upstream accepted dependencies include centered/Organization location linkage", () => {
  const fixturePath = path.resolve(
    __dirname,
    "..",
    "fixtures",
    "saas-scope",
    "sentence.accepted-dependencies.json"
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const deps = Array.isArray(fixture.accepted_dependencies) ? fixture.accepted_dependencies : [];

  assert.ok(
    deps.some((d) => d.label === "patient" && d.head_surface === "centered" && d.dep_surface === "system"),
    "expected accepted centered->system patient dependency"
  );
  assert.ok(
    deps.some((d) => d.label === "location" && d.head_surface === "centered" && d.dep_surface === "Organization"),
    "expected accepted centered->Organization location dependency"
  );
  assert.ok(
    deps.some((d) => d.label === "attribute" && d.head_surface === "centered" && d.dep_surface === "scope"),
    "expected accepted centered->scope attribute dependency"
  );
});
