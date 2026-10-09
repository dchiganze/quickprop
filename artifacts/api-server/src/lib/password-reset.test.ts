import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAdminPasswordResetToken,
  getAdminPasswordResetBaseUrl,
  hashAdminPasswordResetToken,
  matchesAdminRecoveryEmail,
  meetsAdminPasswordPolicy,
  normalizeAdminRecoveryEmail,
} from "./password-reset";

test("admin reset tokens are high-entropy URL-safe values and are stored as hashes", () => {
  const token = createAdminPasswordResetToken();
  const hash = hashAdminPasswordResetToken(token);

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(hashAdminPasswordResetToken(token), hash);
});

test("admin passwords require ten characters, a letter, a number, and a symbol", () => {
  assert.equal(meetsAdminPasswordPolicy("StrongPass1!"), true);
  assert.equal(meetsAdminPasswordPolicy("Short1!"), false);
  assert.equal(meetsAdminPasswordPolicy("lettersOnly!"), false);
  assert.equal(meetsAdminPasswordPolicy("1234567890!"), false);
  assert.equal(meetsAdminPasswordPolicy("Password123"), false);
});

test("the admin recovery address is normalized and matches only the configured mailbox", () => {
  assert.equal(normalizeAdminRecoveryEmail("  Douglas@Melios.co.zw  "), "douglas@melios.co.zw");
  assert.equal(normalizeAdminRecoveryEmail("not-an-email"), null);
  assert.equal(matchesAdminRecoveryEmail("DOUGLAS@MELIOS.CO.ZW", "douglas@melios.co.zw"), true);
  assert.equal(matchesAdminRecoveryEmail("other@melios.co.zw", "douglas@melios.co.zw"), false);
  assert.equal(matchesAdminRecoveryEmail("douglas@melios.co.zw", undefined), false);
});

test("reset links use the published portal URL in production and the workspace domain in development", () => {
  assert.equal(
    getAdminPasswordResetBaseUrl({
      runtimeEnvironment: "production",
      developmentDomain: "workspace.replit.dev",
      productionBaseUrl: "https://www.quickprop.melios.co.zw/admin/",
    }),
    "https://www.quickprop.melios.co.zw/admin",
  );
  assert.equal(
    getAdminPasswordResetBaseUrl({
      runtimeEnvironment: "development",
      developmentDomain: "workspace.replit.dev",
      productionBaseUrl: "https://www.quickprop.melios.co.zw/admin",
    }),
    "https://workspace.replit.dev/admin",
  );
  assert.equal(
    getAdminPasswordResetBaseUrl({
      runtimeEnvironment: "production",
      developmentDomain: undefined,
      productionBaseUrl: "http://www.quickprop.melios.co.zw/admin",
    }),
    null,
  );
});
