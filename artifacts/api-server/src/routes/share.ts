import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import Jimp from "jimp-compact";
import { db, propertiesTable, usersTable } from "@workspace/db";
import { getCanonicalProperty } from "../lib/multi-agent";
import { getPrivateObjectDownloadUrl } from "./storage";

const router: IRouter = Router();

const PUBLIC_STATUSES = ["public", "under_offer", "coming_soon"] as const;
const PUBLIC_AVAILABILITY_STATUSES = ["available", "under_offer"] as const;
const COLLAGE_WIDTH = 1_200;
const COLLAGE_HEIGHT = 630;
const TILE_WIDTH = 400;

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

function previewCacheBuster(req: Request): string {
  const version = text(req.query.v);
  return version ? `?v=${encodeURIComponent(version)}` : "";
}

function isSocialCrawler(req: Request): boolean {
  const userAgent = text(req.headers["user-agent"]).toLowerCase();
  return /(facebookexternalhit|facebot|linkedinbot|twitterbot|whatsapp|slackbot|telegrambot|discordbot)/.test(userAgent);
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

  const collage = await Jimp.create(COLLAGE_WIDTH, COLLAGE_HEIGHT, 0x071D35FF);
  for (let index = 0; index < 3; index += 1) {
    const image = await Jimp.read(available[index] ?? available[0]);
    image.cover(
      TILE_WIDTH,
      COLLAGE_HEIGHT,
      Jimp.HORIZONTAL_ALIGN_CENTER,
      Jimp.VERTICAL_ALIGN_MIDDLE,
    );
    collage.composite(image, index * TILE_WIDTH, 0);
  }
  return collage.getBufferAsync(Jimp.MIME_JPEG);
}

async function renderFallbackCard(): Promise<Buffer> {
  const collage = await Jimp.create(COLLAGE_WIDTH, COLLAGE_HEIGHT, 0x071D35FF);
  const colors = [0x0B6B61FF, 0x138A72FF, 0x32B67AFF];
  for (let index = 0; index < colors.length; index += 1) {
    const tile = await Jimp.create(TILE_WIDTH, COLLAGE_HEIGHT, colors[index]);
    collage.composite(tile, index * TILE_WIDTH, 0);
  }
  return collage.getBufferAsync(Jimp.MIME_JPEG);
}

function htmlPage({
  title,
  description,
  imageUrl,
  shareUrl,
  destinationUrl,
  redirectToDestination = true,
}: {
  title: string;
  description: string;
  imageUrl: string;
  shareUrl: string;
  destinationUrl: string;
  redirectToDestination?: boolean;
}): string {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImageUrl = escapeHtml(imageUrl);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeDestinationUrl = escapeHtml(destinationUrl);
  const redirectHead = redirectToDestination
    ? `<meta http-equiv="refresh" content="0;url=${safeDestinationUrl}">
     <script>window.location.replace(${JSON.stringify(destinationUrl)});</script>`
    : "";
  const body = redirectToDestination
    ? `<p>Opening QuickProp… <a href="${safeDestinationUrl}">Continue to the listing</a></p>`
    : `<main>
    <img src="${safeImageUrl}" alt="${safeTitle}" width="${COLLAGE_WIDTH}" height="${COLLAGE_HEIGHT}">
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <p><a href="${safeDestinationUrl}">View this property on QuickProp</a></p>
  </main>`;

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
    ${redirectHead}
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

async function sendCollage(
  req: Request,
  res: Response,
  sources: string[],
): Promise<void> {
  try {
    const collage = sources.length > 0
      ? await renderCollage(sources, originFor(req))
      : await renderFallbackCard();
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
  const cacheBuster = previewCacheBuster(req);
  const shareUrl = `${origin}${propertySharePath(property)}${cacheBuster}`;
  const destinationUrl = `${origin}${propertyPublicPath(property)}`;
  const imageUrl = `${origin}${propertyCardPath(property)}${cacheBuster}`;
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.type("html").send(htmlPage({
    title: propertyTitle(property),
    description: propertyDescription(property),
    imageUrl,
    shareUrl,
    destinationUrl,
    redirectToDestination: !isSocialCrawler(req),
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
  const cacheBuster = previewCacheBuster(req);
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
  const shareUrl = `${origin}${cataloguePath}${cacheBuster}`;
  const imageUrl = `${origin}${cataloguePath}/card.jpg${cacheBuster}`;

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
    await sendCollage(req, res, []);
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