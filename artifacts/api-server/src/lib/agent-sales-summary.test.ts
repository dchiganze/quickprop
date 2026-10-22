import assert from "node:assert/strict";
import { test } from "node:test";
import { isPastSaleDate, medianSalePrices } from "./agent-sales-summary";

test("medians sort sale prices and handle odd and even sale counts", () => {
  assert.deepEqual(medianSalePrices([
    { currency: "USD", salePrice: 400 }, { currency: "USD", salePrice: 100 },
    { currency: "USD", salePrice: 200 },
  ]), [{ currency: "USD", medianPrice: 200, saleCount: 3 }]);
  assert.deepEqual(medianSalePrices([
    { currency: "USD", salePrice: 400 }, { currency: "USD", salePrice: 100 },
  ]), [{ currency: "USD", medianPrice: 250, saleCount: 2 }]);
});

test("currencies stay separate, blank and invalid prices are excluded", () => {
  assert.deepEqual(medianSalePrices([
    { currency: "usd", salePrice: 100 }, { currency: " USD ", salePrice: 300 },
    { currency: "ZAR", salePrice: 5000 }, { currency: "USD", salePrice: null },
    { currency: "USD", salePrice: 0 }, { currency: "USD", salePrice: -1 },
    { currency: "USD", salePrice: Infinity }, { currency: "", salePrice: 50 },
  ]), [
    { currency: "USD", medianPrice: 200, saleCount: 2 },
    { currency: "ZAR", medianPrice: 5000, saleCount: 1 },
  ]);
  assert.deepEqual(medianSalePrices([]), []);
});

test("sale dates must be real calendar dates and not in the future", () => {
  const today = "2026-10-22";
  for (const value of ["2026-10-23", "2026-02-30", "2025-02-29", "2026-13-01", "yesterday", "1800-01-01"]) {
    assert.equal(isPastSaleDate(value, today), false, value);
  }
  for (const value of ["2024-02-29", "2026-10-22", "2010-01-01"]) {
    assert.equal(isPastSaleDate(value, today), true, value);
  }
});
