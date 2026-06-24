import assert from "node:assert/strict";
import test from "node:test";

import { createPublicToken, publicTokenNamePrefix } from "../src/server.js";

const HEX_TAIL = /-[0-9a-f]{32}$/;

test("createPublicToken is an all-words memorable slug with no random tail", () => {
  for (let i = 0; i < 500; i += 1) {
    const token = createPublicToken();
    assert.doesNotMatch(token, HEX_TAIL, `"${token}" still carries a hex tail`);
    const parts = token.split("-");
    assert.ok(parts.length >= 2, `"${token}" should be at least two words`);
    for (const part of parts) {
      assert.match(part, /^[a-z]+$/, `part "${part}" is not pure lowercase letters`);
    }
    assert.ok(token.length <= 63);
  }
});

test("createPublicToken re-rolls until the name is not taken", () => {
  // isNameTaken reports the first 5 candidates as taken; createPublicToken must
  // keep generating, so it is called at least 6 times before returning.
  let calls = 0;
  const token = createPublicToken(() => {
    calls += 1;
    return calls <= 5;
  });
  assert.ok(calls >= 6, `expected re-rolls, isNameTaken called ${calls} times`);
  assert.match(token, /^[a-z]+(?:-[a-z]+)+$/, `"${token}" is not a clean word name`);
});

test("publicTokenNamePrefix strips a legacy entropy tail but leaves clean names alone", () => {
  const hex = "a".repeat(32);
  // Legacy "<name>-<32hex>" tokens reduce to their name.
  assert.equal(publicTokenNamePrefix(`v1-${hex}`), "v1");
  assert.equal(publicTokenNamePrefix(`quietly-fading-casket-${hex}`), "quietly-fading-casket");
  // New tail-free names are returned unchanged.
  assert.equal(publicTokenNamePrefix("hollow-paperclip"), "hollow-paperclip");
  assert.equal(publicTokenNamePrefix("nostalgic-curie"), "nostalgic-curie");
  assert.equal(publicTokenNamePrefix(""), "");
});

test("a fresh token round-trips through publicTokenNamePrefix unchanged", () => {
  const token = createPublicToken();
  assert.equal(publicTokenNamePrefix(token), token, "tail-free token should be its own name");
});
