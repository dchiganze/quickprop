import { Router, type IRouter } from "express";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import { passkeyCredentialsTable } from "../../../../lib/db/src/schema/passkeys";
import { createSessionToken, readSessionToken } from "../lib/sessions";
import { logAudit, jsonify } from "../lib/helpers";

const router: IRouter = Router();
const challengeTtlMs = 5 * 60 * 1000;
const challenges = new Map<string, { challenge: string; userId?: number; expiresAt: number }>();

const rpId = process.env.QUICKPROP_PASSKEY_RP_ID ?? "www.quickprop.melios.co.zw";
const rpName = "QuickProp";
const origins = [
  `https://${rpId}`,
  "ios:bundle-id:com.quickprop.agent",
  "android:apk-key-hash:iqyBwSZNiX8IrMw47NhbH0UF6TqKWPTQuSFGssqP0uw",
];

function getUserId(authorization: string | undefined): number | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.trim().split(/\s+/);
  const secret = process.env.SESSION_SECRET;
  if (scheme !== "Bearer" || !token || !secret || secret.length < 32) return null;
  return readSessionToken(token, secret);
}

function addChallenge(challenge: string, userId?: number): string {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  challenges.set(key, { challenge, userId, expiresAt: Date.now() + challengeTtlMs });
  for (const [id, value] of challenges) {
    if (value.expiresAt <= Date.now()) challenges.delete(id);
  }
  return key;
}

function takeChallenge(key: unknown, userId?: number) {
  if (typeof key !== "string") return null;
  const stored = challenges.get(key);
  challenges.delete(key);
  if (!stored || stored.expiresAt <= Date.now() || stored.userId !== userId) return null;
  return stored.challenge;
}

async function ensurePasskeyTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS passkey_credentials (
      credential_id text PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_key text NOT NULL,
      counter integer NOT NULL DEFAULT 0,
      transports jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

router.post("/auth/passkeys/registration/options", async (req, res): Promise<void> => {
  const userId = getUserId(req.headers.authorization);
  if (!userId) { res.status(401).json({ error: "Sign in again to add a passkey." }); return; }
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.status, "active"))).limit(1);
  if (!user) { res.status(401).json({ error: "This account is not active." }); return; }
  const existing = await db.select({ credentialId: passkeyCredentialsTable.credentialId, transports: passkeyCredentialsTable.transports })
    .from(passkeyCredentialsTable).where(eq(passkeyCredentialsTable.userId, userId));
  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    excludeCredentials: existing.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports,
    })),
  });
  res.json({ challengeId: addChallenge(options.challenge, userId), options });
});

router.post("/auth/passkeys/registration/verify", async (req, res): Promise<void> => {
  const userId = getUserId(req.headers.authorization);
  const challenge = takeChallenge(req.body?.challengeId, userId ?? undefined);
  if (!userId || !challenge) { res.status(400).json({ error: "Passkey setup expired. Please try again." }); return; }
  try {
    const verification = await verifyRegistrationResponse({
      response: req.body?.credential as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "The passkey could not be verified." });
      return;
    }
    const credential = verification.registrationInfo.credential;
    await db.insert(passkeyCredentialsTable).values({
      credentialId: credential.id,
      userId,
      publicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      transports: credential.transports ?? [],
    }).onConflictDoNothing();
    await logAudit("passkey_added", "user", userId, "Passkey added to QuickProp account", userId);
    res.json({ ok: true });
  } catch (error) {
    req.log.error({ error, userId }, "Passkey registration verification failed");
    res.status(400).json({ error: "The passkey could not be verified. Check your app and try again." });
  }
});

router.post("/auth/passkeys/authentication/options", async (_req, res): Promise<void> => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: "required",
    });
    res.json({ challengeId: addChallenge(options.challenge), options });
  } catch (error) {
    console.error("Unable to generate passkey options", error);
    res.status(503).json({ error: "Passkey sign-in is temporarily unavailable." });
  }
});

router.post("/auth/passkeys/authentication/verify", async (req, res): Promise<void> => {
  const challenge = takeChallenge(req.body?.challengeId);
  if (!challenge) { res.status(400).json({ error: "Passkey sign-in expired. Please try again." }); return; }
  try {
    const response = req.body?.credential as AuthenticationResponseJSON;
    const [stored] = await db.select().from(passkeyCredentialsTable)
      .where(eq(passkeyCredentialsTable.credentialId, response.id)).limit(1);
    if (!stored) { res.status(401).json({ error: "No QuickProp account is linked to this passkey." }); return; }
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64")),
        counter: stored.counter,
        transports: stored.transports as ("ble" | "hybrid" | "internal" | "nfc" | "usb")[],
      },
      requireUserVerification: true,
    });
    if (!verification.verified) { res.status(401).json({ error: "Passkey verification failed." }); return; }
    await db.update(passkeyCredentialsTable)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(passkeyCredentialsTable.credentialId, stored.credentialId));
    const [user] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, stored.userId), eq(usersTable.status, "active"))).limit(1);
    if (!user) { res.status(401).json({ error: "This QuickProp account is not active." }); return; }
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error("Session signing is not configured.");
    const accessToken = createSessionToken(user.id, secret);
    await logAudit("login", "user", user.id, `${user.name} signed in with a passkey`, user.id, user.name);
    const { password: _password, createdAt: _createdAt, ...safeUser } = user;
    res.json({ ...jsonify(safeUser), accessToken });
  } catch (error) {
    req.log.error({ error }, "Passkey authentication failed");
    res.status(401).json({ error: "Passkey sign-in failed. Try again or use SMS." });
  }
});

export { ensurePasskeyTable };
export default router;
