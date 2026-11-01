import assert from "node:assert/strict";
import test from "node:test";
import { signFlyerShareToken, verifyFlyerShareToken } from "./flyer-share-token.js";

const secret = "test-secret-with-at-least-thirty-two-characters";
const payload = {
  agentId: 2535,
  propertyReference: "QP-123",
  objectPath: "/objects/uploads/2535/550e8400-e29b-41d4-a716-446655440000.jpg",
};

test("flyer share tokens round-trip with a valid signature", () => {
  const token = signFlyerShareToken(payload, secret);
  assert.deepEqual(verifyFlyerShareToken(token, secret), payload);
});

test("flyer share tokens reject tampering, mismatched owners, and weak secrets", () => {
  const token = signFlyerShareToken(payload, secret);
  assert.equal(verifyFlyerShareToken(`${token}x`, secret), null);
  assert.equal(verifyFlyerShareToken(token, `${secret}-different`), null);
  assert.throws(() => signFlyerShareToken(payload, "short"));
  assert.throws(() => signFlyerShareToken({
    ...payload,
    objectPath: "/objects/uploads/99/550e8400-e29b-41d4-a716-446655440000.jpg",
  }, secret));
});
