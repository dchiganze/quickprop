import assert from "node:assert/strict";
import test from "node:test";
import { dominantLogoColors } from "./logo-colors";

test("logo palette ignores white borders, black text, and transparent pixels", () => {
  const rgba = new Uint8Array([
    255, 255, 255, 255, 0, 0, 0, 255, 200, 0, 0, 0,
    52, 60, 207, 255, 52, 60, 207, 255, 110, 114, 216, 255,
  ]);
  assert.equal(dominantLogoColors(rgba)[0], "#343CCF");
  assert.ok(!dominantLogoColors(rgba).includes("#FFFFFF"));
  assert.ok(!dominantLogoColors(rgba).includes("#C80000"));
});

test("monochrome or empty logos do not invent a brand colour", () => {
  assert.deepEqual(dominantLogoColors(new Uint8Array()), []);
  assert.deepEqual(dominantLogoColors(new Uint8Array([128, 128, 128, 255])), []);
});
