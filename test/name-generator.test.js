import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVERBS,
  ADJECTIVES,
  NOUNS,
  SURNAMES,
  generateName,
  generateUniqueName,
  makeRng
} from "../src/nameGenerator.js";

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HEX_TAIL = /-[0-9a-f]{32}$/;
const RESERVED = new Set(["p", "index", "404", ""]);

test("generateName always produces a valid DNS-label slug with no random tail", () => {
  for (let i = 0; i < 5000; i += 1) {
    const name = generateName();
    assert.match(name, DNS_LABEL, `"${name}" is not a valid DNS label`);
    assert.ok(name.length <= 63, `"${name}" exceeds 63 chars`);
    assert.ok(!name.startsWith("-") && !name.endsWith("-"), `"${name}" has a boundary hyphen`);
    assert.ok(!name.includes("--"), `"${name}" has a double hyphen`);
    assert.equal(name, name.toLowerCase(), `"${name}" is not lowercase`);
    assert.doesNotMatch(name, HEX_TAIL, `"${name}" still has a hex tail`);
    assert.ok(!RESERVED.has(name), `"${name}" is a reserved slug`);
  }
});

test("names are 2 or 3 real-word parts", () => {
  for (let i = 0; i < 1000; i += 1) {
    const parts = generateName().split("-");
    assert.ok(parts.length === 2 || parts.length === 3, `unexpected part count: ${parts.length}`);
    for (const part of parts) {
      assert.match(part, /^[a-z]+$/, `part "${part}" is not pure lowercase letters`);
    }
  }
});

test("templates draw from the expected word lists", () => {
  const adjNoun = generateName({ template: 0, rng: makeRng(1) }).split("-");
  assert.equal(adjNoun.length, 2);
  assert.ok(ADJECTIVES.includes(adjNoun[0]) && NOUNS.includes(adjNoun[1]));

  const advAdjNoun = generateName({ template: 1, rng: makeRng(2) }).split("-");
  assert.equal(advAdjNoun.length, 3);
  assert.ok(ADVERBS.includes(advAdjNoun[0]));

  const adjSurname = generateName({ template: 3, rng: makeRng(3) }).split("-");
  assert.equal(adjSurname.length, 2);
  assert.ok(ADJECTIVES.includes(adjSurname[0]) && SURNAMES.includes(adjSurname[1]));
});

test("the library is really large (>100M combinations)", () => {
  assert.ok(ADVERBS.length >= 200, `only ${ADVERBS.length} adverbs`);
  assert.ok(ADJECTIVES.length >= 450, `only ${ADJECTIVES.length} adjectives`);
  assert.ok(NOUNS.length >= 550, `only ${NOUNS.length} nouns`);
  assert.ok(SURNAMES.length >= 120, `only ${SURNAMES.length} surnames`);
  // The adverb-adjective-noun shape alone clears 50 million...
  assert.ok(ADVERBS.length * ADJECTIVES.length * NOUNS.length > 50_000_000);
  // ...and the adjective-adjective-noun shape clears 100 million on its own.
  assert.ok(ADJECTIVES.length * (ADJECTIVES.length - 1) * NOUNS.length > 100_000_000);
});

test("output is varied — no degenerate repetition", () => {
  const seen = new Set();
  for (let i = 0; i < 3000; i += 1) {
    seen.add(generateName());
  }
  assert.ok(seen.size > 2800, `only ${seen.size} unique names in 3000 draws`);
});

test("makeRng makes generateName deterministic for tests", () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  const seqA = Array.from({ length: 30 }, () => generateName({ rng: a }));
  const seqB = Array.from({ length: 30 }, () => generateName({ rng: b }));
  assert.deepEqual(seqA, seqB, "same seed should yield the same name sequence");

  const c = makeRng(99999);
  const seqC = Array.from({ length: 30 }, () => generateName({ rng: c }));
  assert.notDeepEqual(seqA, seqC, "different seeds should diverge");
});

test("generateUniqueName re-rolls past a taken name", () => {
  const sequence = ["hollow-paperclip", "vacant-otter", "calm-comet"];
  let i = 0;
  const generate = () => sequence[i++];
  const token = generateUniqueName((name) => name === "hollow-paperclip", { generate });
  assert.equal(token, "vacant-otter", "should skip the taken name and use the next");
});

test("generateUniqueName escalates with extra words when names keep colliding", () => {
  // Treat any name with fewer than 4 parts as taken; the only escape is to
  // append words. The result must therefore grow to >= 4 parts (no digits).
  const token = generateUniqueName((name) => name.split("-").length < 4);
  const parts = token.split("-");
  assert.ok(parts.length >= 4, `expected escalation to >=4 words, got "${token}"`);
  for (const part of parts) {
    assert.match(part, /^[a-z]+$/, `escalated part "${part}" is not a word`);
  }
});

test("generateName throws on an out-of-range template index", () => {
  assert.throws(() => generateName({ template: 99 }), RangeError);
  assert.throws(() => generateName({ template: -1 }), RangeError);
});

test("generateUniqueName throws rather than return a taken slug when exhausted", () => {
  // If literally every candidate collides, returning one would break the
  // token-identity contract — so it must throw instead.
  assert.throws(() => generateUniqueName(() => true), /unique name/);
});
