import assert from "node:assert/strict";
import { test } from "node:test";
import { getAIFlyerErrorMessage } from "./ai-flyer-errors.ts";

test("AI flyer errors show the server-provided explanation", () => {
  assert.equal(
    getAIFlyerErrorMessage({ data: { error: "Property not found" } }),
    "Property not found",
  );
});

test("AI flyer errors also read nested response payloads", () => {
  assert.equal(
    getAIFlyerErrorMessage({ response: { data: { error: "AI is temporarily unavailable." } } }),
    "AI is temporarily unavailable.",
  );
});

test("AI flyer errors extract server text from HTTP error messages", () => {
  assert.equal(
    getAIFlyerErrorMessage(new Error("HTTP 404 Not Found: Published property not found")),
    "Published property not found",
  );
});

test("AI flyer errors use a connection hint for non-HTTP failures", () => {
  assert.match(
    getAIFlyerErrorMessage(new TypeError("Network request failed")),
    /Check your connection/,
  );
});
