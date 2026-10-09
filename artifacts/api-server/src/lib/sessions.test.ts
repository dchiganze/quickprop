import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSessionToken, readSessionToken } from "./sessions";

const secret = "session-test-secret-with-at-least-32-characters";

describe("signed browser sessions", () => {
  it("round-trips the authenticated user ID", () => {
    const token = createSessionToken(42, secret);
    assert.equal(readSessionToken(token, secret), 42);
  });

  it("rejects legacy numeric cookies, malformed tokens, and tokens signed with another secret", () => {
    assert.equal(readSessionToken("42", secret), null);
    assert.equal(readSessionToken("not-a-session-token", secret), null);
    assert.equal(readSessionToken(createSessionToken(42, secret), `${secret}-different`), null);
  });

  it("rejects a modified payload or signature", () => {
    const token = createSessionToken(42, secret);
    const parts = token.split(".");
    const payload = Buffer.from(JSON.stringify({ sub: 43, exp: Math.floor(Date.now() / 1000) + 60 })).toString("base64url");
    const alteredPayload = `${parts[0]}.${payload}.${parts[2]}`;
    const signatureFirstCharacter = parts[2][0] === "A" ? "B" : "A";
    const alteredSignature = `${parts[0]}.${parts[1]}.${signatureFirstCharacter}${parts[2].slice(1)}`;

    assert.equal(readSessionToken(alteredPayload, secret), null);
    assert.equal(readSessionToken(alteredSignature, secret), null);
  });
});
