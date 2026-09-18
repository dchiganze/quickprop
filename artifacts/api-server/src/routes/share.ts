import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, propertiesTable, usersTable } from "@workspace/db";
import { getCanonicalProperty } from "../lib/multi-agent";
import { getPrivateObjectDownloadUrl } from "./storage";

const execFile = promisify(execFileCallback);
const router: IRouter = Router();

const PUBLIC_STATUSES = ["public", "under_offer", "coming_soon"] as const;
const PUBLIC_AVAILABILITY_STATUSES = ["available", "under_offer"] as const;
const COLLAGE_WIDTH = 1_200;
const COLLAGE_HEIGHT = 630;
const TILE_WIDTH = 400;
const MAGICK_TIMEOUT_MS = 30_000;

type PublicProperty = NonNullable<Awaited<ReturnType<typeof getCanonicalProperty>>>;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function originFor(req: Request): string {
  const forwardedProto = text(req.headers["x-forwarded-proto"]).split(",")[0];
  const protocol = forwardedProto || req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function propertyPublicPath(property: PublicProperty): string {
  return `/properties/${encodeURIComponent(property.reference.toLowerCase())}`;
}

function propertySharePath(property: PublicProperty): string {
  return `/api/share/properties/${encodeURIComponent(property.reference)}`;
}

function propertyCardPath(property: PublicProperty): string {
  return `${propertySharePath(property)}/card.jpg`;
}

function propertyPhotoSources(property: PublicProperty): string[] {
  return [...new Set([
    property.coverImage,
    ...(property.photos ?? []),
  ].map(text).filter(Boolean))].slice(0, 3);
}

function formatPrice(property: PublicProperty): string {
  const amount = Number(property.price ?? 0);
  if (!amount) return "";
  return `${property.currency || "USD"} ${amount.toLocaleString("en-US")}`;
}

function propertyTitle(property: PublicProperty): string {
  const location = [text(property.suburb), text(property.city)].filter(Boolean).join(", ");
  return [text(property.title), location].filter(Boolean).join(" · ") || property.reference;
}

function propertyDescription(property: PublicProperty): string {
  const details = [
    formatPrice(property),
    property.bedrooms ? `${property.bedrooms} bedrooms` : "",
    property.bathrooms ? `${property.bathrooms} bathrooms` : "",
    text(property.description),
  ].filter(Boolean);
  return details.join(" · ") || `View property ${property.reference} on QuickProp.`;
}

async function findPublicProperty(reference: string): Promise<PublicProperty | null> {
  const [found] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.reference, reference.toUpperCase()));
  if (!found) return null;

  const property = await getCanonicalProperty(found.id);
  if (
    !property
    || !PUBLIC_STATUSES.includes(property.status as (typeof PUBLIC_STATUSES)[number])
    || !PUBLIC_AVAILABILITY_STATUSES.includes(property.availabilityStatus as (typeof PUBLIC_AVAILABILITY_STATUSES)[number])
  ) {
    return null;
  }
  return property;
}

async function publicPropertiesForCatalogue(agentId?: number): Promise<PublicProperty[]> {
  const conditions = [
    inArray(propertiesTable.status, [...PUBLIC_STATUSES]),
    inArray(propertiesTable.availabilityStatus, [...PUBLIC_AVAILABILITY_STATUSES]),
  ];
  if (agentId) conditions.push(eq(propertiesTable.agentId, agentId));

  const rows = await db
    .select()
    .from(propertiesTable)
    .where(and(...conditions))
    .orderBy(desc(propertiesTable.publishedAt), desc(propertiesTable.updatedAt));

  const properties = await Promise.all(rows.map((row) => getCanonicalProperty(row.id)));
  const seen = new Set<number>();
  return properties.filter((property): property is PublicProperty => {
    if (
      !property
      || seen.has(property.id)
      || !PUBLIC_STATUSES.includes(property.status as (typeof PUBLIC_STATUSES)[number])
      || !PUBLIC_AVAILABILITY_STATUSES.includes(property.availabilityStatus as (typeof PUBLIC_AVAILABILITY_STATUSES)[number])
    ) {
      return false;
    }
    seen.add(property.id);
    return true;
  });
}

async function imageSourceUrl(source: string, origin: string): Promise<string> {
  if (source.startsWith("/api/storage/objects/")) {
    return getPrivateObjectDownloadUrl(source.replace(/^\/api\/storage/, ""));
  }
  return new URL(source, origin).toString();
}

async function fetchImage(source: string, origin: string): Promise<Buffer | null> {
  try {
    const response = await fetch(await imageSourceUrl(source, origin), {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length > 0 && bytes.length <= 12 * 1024 * 1024 ? bytes : null;
  } catch {
    return null;
  }
}

async function renderCollage(sources: string[], origin: string): Promise<Buffer> {
  const images = await Promise.all(sources.map((source) => fetchImage(source, origin)));
  const available = images.filter((image): image is Buffer => image !== null);
  if (available.length === 0) throw new Error("No public property images are available.");

  const workingDirectory = await fs.mkdtemp(`/tmp/quickprop-share-${randomUUID()}-`);
  const inputPaths: string[] = [];
  const outputPath = `${workingDirectory}/collage.jpg`;

  try {
    for (let index = 0; index < 3; index += 1) {
      const image = available[index] ?? available[0];
      const inputPath = `${workingDirectory}/photo-${index}.img`;
      await fs.writeFile(inputPath, image);
      inputPaths.push(inputPath);
    }

    const args = inputPaths.flatMap((inputPath) => [
      inputPath,
      "-auto-orient",
      "-thumbnail",
      `${TILE_WIDTH}x${COLLAGE_HEIGHT}^`,
      "-gravity",
      "center",
      "-extent",
      `${TILE_WIDTH}x${COLLAGE_HEIGHT}`,
    ]);
    args.push("+append", "-strip", "-interlace", "Plane", "-quality", "86", outputPath);

    await execFile(process.env.MAGICK_BINARY || "magick", args, {
      timeout: MAGICK_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024,
    });
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(workingDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

function htmlPage({
  title,
  description,
  imageUrl,
  shareUrl,
  destinationUrl,
}: {
  title: string;
  description: string;
  imageUrl: string;
  shareUrl: string;
  destinationUrl: string;
}): string {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImageUrl = escapeHtml(imageUrl);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeDestinationUrl = escapeHtml(destinationUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle} · QuickProp</title>
    <meta name="description" content="${safeDescription}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:image" content="${safeImageUrl}">
    <meta property="og:image:width" content="${COLLAGE_WIDTH}">
    <meta property="og:image:height" content="${COLLAGE_HEIGHT}">
    <meta property="og:url" content="${safeShareUrl}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${safeImageUrl}">
    <meta http-equiv="refresh" content="0;url=${safeDestinationUrl}">
    <script>window.location.replace(${JSON.stringify(destinationUrl)});</script>
  </head>
  <body>
    <p>Opening QuickProp… <a href="${safeDestinationUrl}">Continue to the listing</a></p>
  </body>
</html>`;
}

async function sendCollage(
  req: Request,
  res: Response,
  sources: string[],
): Promise<void> {
  try {
    const collage = await renderCollage(sources, originFor(req));
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.type("jpg").send(collage);
  } catch (error) {
    req.log.warn({ err: error }, "Unable to render share collage");
    res.status(404).json({ error: "Share image unavailable" });
  }
}

router.get("/share/properties/:reference/card.jpg", async (req, res): Promise<void> => {
  const property = await findPublicProperty(req.params.reference ?? "");
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  await sendCollage(req, res, propertyPhotoSources(property));
});

router.get("/share/properties/:reference", async (req, res): Promise<void> => {
  const property = await findPublicProperty(req.params.reference ?? "");
  if (!property) {
    res.status(404).send("Property not found");
    return;
  }

  const origin = originFor(req);
  const shareUrl = `${origin}${propertySharePath(property)}`;
  const destinationUrl = `${origin}${propertyPublicPath(property)}`;
  const imageUrl = `${origin}${propertyCardPath(property)}`;
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.type("html").send(htmlPage({
    title: propertyTitle(property),
    description: propertyDescription(property),
    imageUrl,
    shareUrl,
    destinationUrl,
  }));
});

async function sendCataloguePage(
  req: Request,
  res: Response,
  agentId: number | undefined,
  agentName?: string,
): Promise<void> {
  const properties = await publicPropertiesForCatalogue(agentId);
  if (agentId && properties.length === 0) {
    res.status(404).send("Catalogue not found");
    return;
  }

  const origin = originFor(req);
  const cataloguePath = agentId
    ? `/api/share/catalogues/agents/${agentId}`
    : "/api/share/catalogues/company";
  const destinationUrl = agentId ? `${origin}/agents/${agentId}` : `${origin}/`;
  const title = agentId
    ? `${agentName || "Agent"}'s property catalogue · QuickProp`
    : "QuickProp property catalogue";
  const description = agentId
    ? `View my entire catalogue here · ${properties.length} published ${properties.length === 1 ? "property" : "properties"}.`
    : `View the entire QuickProp catalogue here · ${properties.length} published ${properties.length === 1 ? "property" : "properties"}.`;
  const shareUrl = `${origin}${cataloguePath}`;
  const imageUrl = `${shareUrl}/card.jpg`;

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.type("html").send(htmlPage({
    title,
    description,
    imageUrl,
    shareUrl,
    destinationUrl,
  }));
}

async function sendCatalogueCard(
  req: Request,
  res: Response,
  agentId: number | undefined,
): Promise<void> {
  const properties = await publicPropertiesForCatalogue(agentId);
  const sources = properties.flatMap(propertyPhotoSources).slice(0, 3);
  if (sources.length === 0) {
    res.status(404).json({ error: "Catalogue image unavailable" });
    return;
  }
  await sendCollage(req, res, sources);
}

router.get("/share/catalogues/company/card.jpg", async (req, res): Promise<void> => {
  await sendCatalogueCard(req, res, undefined);
});

router.get("/share/catalogues/company", async (req, res): Promise<void> => {
  await sendCataloguePage(req, res, undefined);
});

router.get("/share/catalogues/agents/:agentId/card.jpg", async (req, res): Promise<void> => {
  const agentId = Number(req.params.agentId);
  if (!Number.isInteger(agentId) || agentId <= 0) {
    res.status(404).json({ error: "Catalogue not found" });
    return;
  }
  await sendCatalogueCard(req, res, agentId);
});

router.get("/share/catalogues/agents/:agentId", async (req, res): Promise<void> => {
  const agentId = Number(req.params.agentId);
  if (!Number.isInteger(agentId) || agentId <= 0) {
    res.status(404).send("Catalogue not found");
    return;
  }

  const [agent] = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, agentId));
  if (!agent) {
    res.status(404).send("Catalogue not found");
    return;
  }
  await sendCataloguePage(req, res, agentId, agent.name);
});

export default router;