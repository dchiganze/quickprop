import assert from "node:assert/strict";
import { test } from "node:test";
import { UpdateAgencyRelationshipPriceBody } from "@workspace/api-zod";
import { canUpdateAgencyOfferPrice, isValidAgencyOfferPrice } from "./multi-agent";

test("agency offer price updates require a finite positive amount", () => {
  assert.equal(UpdateAgencyRelationshipPriceBody.safeParse({ askingPrice: 275000 }).success, true);
  for (const askingPrice of [0, -1, "275000"]) {
    assert.equal(
      UpdateAgencyRelationshipPriceBody.safeParse({ askingPrice }).success,
      false,
      `expected ${String(askingPrice)} to be rejected`,
    );
  }
  for (const askingPrice of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(isValidAgencyOfferPrice(askingPrice), false, `expected ${String(askingPrice)} to be rejected`);
  }
  assert.equal(isValidAgencyOfferPrice(275000), true);
});

test("an agent can edit their own agency offer, while office administrators can manage offers", () => {
  assert.equal(canUpdateAgencyOfferPrice({ id: 12, role: "agent" }, 12), true);
  assert.equal(canUpdateAgencyOfferPrice({ id: 99, role: "admin" }, 12), true);
  assert.equal(canUpdateAgencyOfferPrice({ id: 99, role: "principal" }, 12), true);
  assert.equal(canUpdateAgencyOfferPrice({ id: 99, role: "agent" }, 12), false);
});
