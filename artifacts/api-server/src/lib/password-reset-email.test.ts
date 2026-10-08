import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  checkAdminPasswordResetEmailReadiness,
  sendAdminPasswordResetEmail,
} from "./housekeeping-delivery";

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("admin password reset email readiness requires a Resend API key", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.QUICKPROP_EMAIL_FROM;
  delete process.env.RESEND_API_KEY;
  process.env.QUICKPROP_EMAIL_FROM = "QuickProp <reset@example.test>";

  try {
    assert.deepEqual(await checkAdminPasswordResetEmailReadiness(), {
      ready: false,
      reason: "resend_credentials_missing",
    });
  } finally {
    restoreEnv("RESEND_API_KEY", previousKey);
    restoreEnv("QUICKPROP_EMAIL_FROM", previousFrom);
  }
});

test("admin password reset email readiness checks the verified sender domain with Resend", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.QUICKPROP_EMAIL_FROM;
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.QUICKPROP_EMAIL_FROM = "QuickProp <reset@example.test>";
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async (
      input: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ): Promise<Response> => {
      assert.equal(String(input), "https://api.resend.com/domains");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-resend-key");
      return Response.json({
        data: [{ name: "example.test", status: "verified" }],
      });
    },
  );

  try {
    assert.deepEqual(await checkAdminPasswordResetEmailReadiness(), { ready: true });
  } finally {
    fetchMock.mock.restore();
    restoreEnv("RESEND_API_KEY", previousKey);
    restoreEnv("QUICKPROP_EMAIL_FROM", previousFrom);
  }
});

test("admin password reset email sends directly through Resend with an idempotency key", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.QUICKPROP_EMAIL_FROM;
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.QUICKPROP_EMAIL_FROM = "QuickProp <reset@example.test>";
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async (
      input: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ): Promise<Response> => {
      assert.equal(String(input), "https://api.resend.com/emails");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer test-resend-key");
      assert.equal(headers.get("idempotency-key"), "reset-request-42");
      const body = JSON.parse(String(init?.body)) as {
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
    fetchMock.mock.restore();
    restoreEnv("RESEND_API_KEY", previousKey);
    restoreEnv("QUICKPROP_EMAIL_FROM", previousFrom);
  }
});
