import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, inArray, or, sql } from "drizzle-orm";
import { db, propertiesTable } from "@workspace/db";
import { currentUser } from "./auth";

const router: IRouter = Router();
const SIDECAR = "http://127.0.0.1:1106";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const PUBLIC_PROPERTY_STATUSES = ["public", "under_offer", "coming_soon"];

function objectDirectory(): string {
  const value = process.env.PRIVATE_OBJECT_DIR;
  if (!value) throw new Error("Object storage is not configured.");
  return value.replace(/\/+$/, "");
}

async function signedObjectUrl(objectName: string, method: "GET" | "PUT"): Promise<string> {
  const fullPath = `${objectDirectory()}/${objectName}`;
  const [, bucketName, ...nameParts] = fullPath.split("/");
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: nameParts.join("/"),
      method,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Could not sign object URL (${response.status}).`);
  const data = await response.json() as { signed_url?: string };
  if (!data.signed_url) throw new Error("Object storage did not return a signed URL.");
  return data.signed_url;
}

// Files are sent directly from the device to object storage. The API only
// grants short-lived PUT URLs, so image bytes never pass through the server.
router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, size, contentType } = req.body as Record<string, unknown>;
  if (
    typeof name !== "string" || name.trim().length === 0 ||
    typeof size !== "number" || !Number.isInteger(size) || size < 1 ||
    typeof contentType !== "string" ||
    (contentType.startsWith("image/") ? size > MAX_UPLOAD_BYTES : !VIDEO_MIME_TYPES.has(contentType) || size > MAX_VIDEO_UPLOAD_BYTES)
  ) {
    res.status(400).json({ error: "Upload must be an image under 25 MB or an MP4, MOV, or WebM video under 100 MB." });
    return;
  }

  const extension = name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
  const objectName = `uploads/${user.id}/${randomUUID()}.${extension}`;
  try {
    const uploadURL = await signedObjectUrl(objectName, "PUT");
    res.json({
      uploadURL,
      objectPath: `/objects/${objectName}`,
      metadata: { name, size, contentType },
    });
  } catch (error) {
    req.log.error({ err: error }, "Unable to request media upload URL");
    res.status(500).json({ error: "Unable to prepare media upload." });
  }
});

// Listing photos are public only through an opaque object path. This route
// generates a fresh, short-lived read URL on every request, keeping photo
// references durable without storing expiring signed URLs in the database.
router.get("/storage/objects/*path", async (req, res): Promise<void> => {
  const rawPath = req.params.path;
  const objectName = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
  if (!objectName || objectName.includes("..") || !/^uploads\/\d+\/[a-f0-9-]+\.[a-z0-9]{1,8}$/i.test(objectName)) {
    res.status(404).json({ error: "Object not found" });
    return;
  }
  try {
    const mediaUrlSuffix = `/api/storage/objects/${objectName}`;
    const [publicProperty] = await db
      .select({ id: propertiesTable.id })
      .from(propertiesTable)
      .where(and(
        inArray(propertiesTable.status, PUBLIC_PROPERTY_STATUSES),
        or(
          sql`EXISTS (SELECT 1 FROM unnest(${propertiesTable.photos}) AS photo WHERE photo LIKE ${`%${mediaUrlSuffix}`})`,
          sql`${propertiesTable.videoUrl} LIKE ${`%${mediaUrlSuffix}`}`,
        ),
      ))
      .limit(1);
    if (!publicProperty) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    res.redirect(302, await signedObjectUrl(objectName, "GET"));
  } catch (error) {
    req.log.error({ err: error }, "Unable to serve stored media");
    res.status(404).json({ error: "Object not found" });
  }
});

export default router;