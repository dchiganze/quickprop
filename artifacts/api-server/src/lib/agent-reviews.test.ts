import assert from "node:assert/strict";
import { test } from "node:test";
import { createReviewToken, hashReviewToken } from "./agent-review-tokens";

test("review tokens are random, fixed-length, and stored as one-way hashes", () => {
  const token = createReviewToken();
  const hash = hashReviewToken(token);

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(hashReviewToken(token), hash);
  assert.notEqual(hashReviewToken(createReviewToken()), hash);
});