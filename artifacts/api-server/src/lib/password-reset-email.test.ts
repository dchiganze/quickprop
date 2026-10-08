import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  checkAdminPasswordResetEmailReadiness,
  sendAdminPasswordResetEmail,
} from "./housekeeping-delivery";

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("admin password reset email readiness requires a configured sender", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.QUICKPROP_EMAIL_FROM;
  process.env.RESEND_API_KEY = "unused-key";
  delete process.env.QUICKPROP_EMAIL_FROM;

  try {
    assert.deepEqual(await checkAdminPasswordResetEmailReadiness(), {
      ready: false,
      reason: "sender_not_configured",
    });
  } finally {
    restoreEnv("RESEND_API_KEY", previousKey);
    restoreEnv("QUICKPROP_EMAIL_FROM", previousFrom);
  }
});

test("admin password reset email readiness does not require an API key", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.QUICKPROP_EMAIL_FROM;
  delete process.env.RESEND_API_KEY;
  process.env.QUICKPROP_EMAIL_FROM = "QuickProp <reset@example.test>";

  try {
    assert.deepEqual(await checkAdminPasswordResetEmailReadiness(), { ready: true });
  } finally {
    restoreEnv("RESEND_API_KEY", previousKey);
    restoreEnv("QUICKPROP_EMAIL_FROM", previousFrom);
  }
});

test("admin password reset email sends directly through Resend with an idempotency key", async () => {
  const previousFrom = process.env.QUICKPROP_EMAIL_FROM;
  process.env.QUICKPROP_EMAIL_FROM = "QuickProp <reset@example.test>";
  const proxyMock = mock.method(
    ReplitConnectors.prototype,
    "proxy",
    async (
      connectorName: string,
      path: string,
      options?: {
        method?: string;
        body?: unknown;
        headers?: Record<string, string>;
      },
    ): Promise<Response> => {
      assert.equal(connectorName, "resend");
      assert.equal(path, "/emails");
      assert.equal(options?.method, "POST");
      assert.equal(options?.headers?.["Idempotency-Key"], "reset-request-42");
      const body = options?.body as {
        from: string;
        to: string[];
        subject: string;
        text: string;
        html: string;
      };
      assert.equal(body.from, "QuickProp <reset@example.test>");
      assert.deepEqual(body.to, ["admin@example.test"]);
      assert.match(body.text, /https:\/\/quickprop\.example\.test\/reset/);
      assert.match(body.html, /https:\/\/quickprop\.example\.test\/reset/);
      return Response.json({ id: "resend-message-42" });
    },
  );

  try {
    assert.deepEqual(
      await sendAdminPasswordResetEmail(
        "admin@example.test",
        "https://quickprop.example.test/reset",
        "reset-request-42",
      ),
      { status: "sent", providerMessageId: "resend-message-42" },
    );
  } finally {
    proxyMock.mock.restore();
    restoreEnv("QUICKPROP_EMAIL_FROM", previousFrom);
  }
});
