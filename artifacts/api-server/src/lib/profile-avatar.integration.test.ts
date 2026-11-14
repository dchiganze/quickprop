import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import { eq } from "drizzle-orm";
import { auditLogTable, db, pool, usersTable } from "@workspace/db";
import authRouter from "../routes/auth";
import publicRouter from "../routes/public";
import storageRouter from "../routes/storage";
import { hashPassword } from "./passwords";
import { ensureAgentPastSalesTable } from "./agent-sales";

test("an agent's photo becomes public only after they opt in", async () => {
  assert.notEqual(process.env.REPLIT_DEPLOYMENT, "1", "Never run this fixture test in production");
  await ensureAgentPastSalesTable();

  const fixtureId = crypto.randomUUID();
  const password = "profile-photo-test-password";
  let userId: number | undefined;
  const originalFetch = globalThis.fetch;
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  app.use(publicRouter);
  app.use(storageRouter);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    accessToken?: string,
  ) => fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });

  try {
    const [agent] = await db.insert(usersTable).values({
      name: "Profile photo test agent",
      email: `${fixtureId}@example.invalid`,
      password: await hashPassword(password),
      role: "agent",
    }).returning();
    userId = agent.id;

    const loginResponse = await request("/auth/login", "POST", { email: agent.email, password });
    assert.equal(loginResponse.status, 200);
    const login = await loginResponse.json() as { accessToken?: string };
    assert.ok(login.accessToken);

    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/object-storage/signed-object-url")) {
        const signedRequest = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        return Response.json({
          signed_url: signedRequest.method === "PUT" ? "https://storage.test/upload" : "https://storage.test/download",
        });
      }
      if (url === "https://storage.test/upload") return new Response(null, { status: 200 });
      return originalFetch(input, init);
    };

    const uploadResponse = await request(
      "/storage/uploads/request-url",
      "POST",
      { name: "profile-photo.jpg", size: 3, contentType: "image/jpeg" },
      login.accessToken,
    );
    assert.equal(uploadResponse.status, 200);
    const upload = await uploadResponse.json() as { uploadURL: string; objectPath: string };
    assert.ok(upload.objectPath.startsWith(`/objects/uploads/${agent.id}/`));

    const uploaded = await fetch(upload.uploadURL, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: new Uint8Array([1, 2, 3]),
    });
    assert.equal(uploaded.status, 200, "the client can send the selected image to its signed upload URL");

    const mediaPath = `/storage${upload.objectPath}`;
    assert.equal((await request(mediaPath)).status, 404, "a private upload is not public before consent");

    const avatarUrl = `https://www.quickprop.co.zw/api/storage${upload.objectPath}`;
    const wrongOwner = avatarUrl.replace(`/uploads/${agent.id}/`, `/uploads/${agent.id + 1}/`);
    assert.equal(
      (await request("/auth/profile/avatar", "PATCH", { avatarUrl: wrongOwner }, login.accessToken)).status,
      400,
      "an agent cannot publish another user's upload",
    );

    const publishResponse = await request(
      "/auth/profile/avatar",
      "PATCH",
      { avatarUrl },
      login.accessToken,
    );
    assert.equal(publishResponse.status, 200);
    assert.equal((await publishResponse.json() as { avatarUrl: string }).avatarUrl, avatarUrl);

    const publicProfileResponse = await request(`/public/agents/${agent.id}`);
    assert.equal(publicProfileResponse.status, 200);
    const publicProfile = await publicProfileResponse.json() as { agent?: { avatarUrl?: string | null } };
    assert.equal(publicProfile.agent?.avatarUrl, avatarUrl);

    const publicMediaResponse = await fetch(`${base}${mediaPath}`, { redirect: "manual" });
    assert.equal(publicMediaResponse.status, 302, "the opted-in avatar is anonymously readable");
    assert.equal(publicMediaResponse.headers.get("location"), "https://storage.test/download");
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (userId !== undefined) {
      await db.delete(auditLogTable).where(eq(auditLogTable.userId, userId));
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
    await pool.end();
  }
});
