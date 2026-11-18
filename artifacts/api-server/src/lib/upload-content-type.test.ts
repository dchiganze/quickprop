import assert from "node:assert/strict";
import test from "node:test";
import { resolveUploadContentType } from "./upload-content-type.js";

test("infers supported media MIME types when clients send a generic blob type", () => {
  assert.equal(resolveUploadContentType("image.HEIC", "application/octet-stream"), "image/heic");
  assert.equal(resolveUploadContentType("photo.jpeg", undefined), "image/jpeg");
  assert.equal(resolveUploadContentType("tour.mov", "binary/octet-stream"), "video/quicktime");
});

test("normalizes valid supplied MIME types and preserves them", () => {
  assert.equal(resolveUploadContentType("photo.jpg", "image/webp; charset=binary"), "image/webp");
  assert.equal(resolveUploadContentType("tour.mp4", "video/webm"), "video/webm");
});

test("does not guess a MIME type for unknown generic files", () => {
  assert.equal(resolveUploadContentType("payload.bin", "application/octet-stream"), "application/octet-stream");
});
