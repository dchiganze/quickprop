import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canUseEmailPasswordSetup,
  createAdminPasswordResetToken,
  createAgentSetupToken,
  createPasswordSetupCode,
  getAdminPasswordResetBaseUrl,
  hashAdminPasswordResetToken,
  hashAgentSetupToken,
  hashPasswordSetupCode,
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

test("agent setup tokens are high-entropy URL-safe values and are stored as hashes", () => {
  const token = createAgentSetupToken();
  const hash = hashAgentSetupToken(token);

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(hashAgentSetupToken(token), hash);
});

test("first-time password codes are eight digits and are HMAC-bound to the user", () => {
  const code = createPasswordSetupCode();
  const hash = hashPasswordSetupCode(code, 42, "test-session-secret");

  assert.match(code, /^\d{8}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashPasswordSetupCode(code, 42, "test-session-secret"), hash);
  assert.notEqual(hashPasswordSetupCode(code, 43, "test-session-secret"), hash);
  assert.notEqual(hashPasswordSetupCode(code, 42, "another-session-secret"), hash);
});

test("active agents can request and verify email setup codes without an admin-set flag", () => {
  assert.equal(canUseEmailPasswordSetup({
    role: "agent",
    status: "active",
    passwordSetupRequired: false,
  }), true);
  assert.equal(canUseEmailPasswordSetup({
    role: "senior_agent",
    status: "active",
    passwordSetupRequired: false,
  }), true);
});

test("email-code password setup preserves role and account-status gates", () => {
  assert.equal(canUseEmailPasswordSetup({
    role: "principal",
    status: "active",
    passwordSetupRequired: false,
  }), false);
  assert.equal(canUseEmailPasswordSetup({
    role: "admin",
    status: "active",
    passwordSetupRequired: true,
  }), true);
  assert.equal(canUseEmailPasswordSetup({
    role: "agent",
    status: "invited",
    passwordSetupRequired: false,
  }), false);
  assert.equal(canUseEmailPasswordSetup({
    role: "agent",
    status: "inactive",
    passwordSetupRequired: false,
  }), false);
  assert.equal(canUseEmailPasswordSetup({
    role: "buyer",
    status: "active",
    passwordSetupRequired: false,
  }), false);
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
