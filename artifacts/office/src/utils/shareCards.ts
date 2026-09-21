import type { Property } from '@workspace/api-client-react';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const PHOTO_HEIGHT = 984;
const GREEN = '#10B981';
const NAVY = '#0B1929';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';

function formatPrice(property: Pick<Property, 'price' | 'currency' | 'listingType'>): string {
  const amount = property.price >= 1_000_000
    ? `${(property.price / 1_000_000).toFixed(1)}M`
    : property.price.toLocaleString();
  return `${property.currency} ${amount}${property.listingType === 'rent' ? '/month' : ''}`;
}

function listingTypeLabel(listingType: string): string {
  return listingType === 'sale' ? 'For Sale' : listingType === 'rent' ? 'To Rent' : listingType;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines?: number,
): number {
  const lines = wrapLines(ctx, text, maxWidth);
  const visibleLines = maxLines ? lines.slice(0, maxLines) : lines;
  visibleLines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return visibleLines.length * lineHeight;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the property photo.'));
    image.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, text: string) {
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, 0, CANVAS_WIDTH, PHOTO_HEIGHT);
  ctx.fillStyle = GREEN;
  ctx.font = '800 72px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('QuickProp', CANVAS_WIDTH / 2, PHOTO_HEIGHT / 2 - 12);
  ctx.fillStyle = MUTED;
  ctx.font = '600 28px Arial';
  ctx.fillText(text, CANVAS_WIDTH / 2, PHOTO_HEIGHT / 2 + 48);
  ctx.textAlign = 'left';
}

function drawPhotoPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
) {
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = GREEN;
  ctx.font = '800 42px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('QuickProp', x + width / 2, y + height / 2 - 8);
  ctx.fillStyle = MUTED;
  ctx.font = '600 22px Arial';
  ctx.fillText(text, x + width / 2, y + height / 2 + 34);
  ctx.textAlign = 'left';
}

async function drawPhotoTile(
  ctx: CanvasRenderingContext2D,
  source: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!source) {
    drawPhotoPlaceholder(ctx, x, y, width, height, 'Photo unavailable');
    return;
  }

  try {
    drawCoverImage(ctx, await loadImage(source), x, y, width, height);
  } catch {
    drawPhotoPlaceholder(ctx, x, y, width, height, 'Photo unavailable');
  }
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Could not prepare the share image.'));
    }, 'image/jpeg', 0.92);
  });
}

export function buildPropertyShareCaption(
  property: Property,
  publicUrl: string,
  catalogueUrl = publicUrl,
): string {
  const location = property.address && property.addressVisible
    ? `${property.address}, ${property.suburb}`
    : property.suburb;
  const stats = [
    property.bedrooms ? `${property.bedrooms} bed` : '',
    property.bathrooms ? `${property.bathrooms} bath` : '',
    property.parking ? `${property.parking} parking` : '',
  ].filter(Boolean).join('  |  ');
  const lines = [
    `*${property.title}*`,
    `📍 ${location}`,
    `💰 *${formatPrice(property)}*${property.negotiable ? ' _(Negotiable)_' : ''}`,
  ];
  if (stats) lines.push(stats);
  if (property.description?.trim()) {
    const description = property.description.replace(/\s+/g, ' ').trim();
    lines.push(`📝 ${description.slice(0, 220)}${description.length > 220 ? '…' : ''}`);
  }
  lines.push(`📋 Ref: *${property.reference}*`);
  lines.push(`View my entire catalogue here: ${catalogueUrl}`);
  return lines.join('\n');
}

export function buildPropertySocialCaption(
  property: Property,
  publicUrl: string,
): string {
  const listingType = property.listingType === 'sale'
    ? 'For Sale'
    : property.listingType === 'rent'
      ? 'To Rent'
      : property.listingType;
  const location = property.address && property.addressVisible
    ? `${property.address}, ${property.suburb}`
    : [property.suburb, property.city].filter(Boolean).join(', ');
  const lines = [
    property.title || `${listingType} — ${property.suburb}`,
    location ? `📍 ${location}` : '',
    `💰 ${formatPrice(property)}${property.negotiable ? ' (Negotiable)' : ''}`,
  ].filter(Boolean);

  const stats = [
    property.bedrooms ? `${property.bedrooms} bed` : '',
    property.bathrooms ? `${property.bathrooms} bath` : '',
    property.parking ? `${property.parking} parking` : '',
  ].filter(Boolean);
  if (stats.length) lines.push(stats.join('  |  '));

  const sizes = [
    property.landSize ? `Land: ${property.landSize.toLocaleString()}m²` : '',
    property.buildingSize ? `Floor: ${property.buildingSize.toLocaleString()}m²` : '',
  ].filter(Boolean);
  if (sizes.length) lines.push(`📐 ${sizes.join('  |  ')}`);

  const description = property.description?.replace(/\s+/g, ' ').trim();
  if (description) lines.push('', description);

  const features = (property.features ?? []).filter(Boolean).slice(0, 8);
  if (features.length) lines.push('', 'Features:', ...features.map(feature => `• ${feature}`));

  lines.push('', `Ref: ${property.reference}`, `View full listing: ${publicUrl}`);
  return lines.join('\n');
}

export function buildCatalogueShareCaption(
  properties: Property[],
  mode: 'company' | 'agent',
  agentName: string | undefined,
  catalogueUrl: string,
): string {
  const forSale = properties.filter(property => property.listingType === 'sale');
  const forRent = properties.filter(property => property.listingType === 'rent');
  const lines = [
    '*QuickProp — Property Brochure*',
    '_Your trusted Harare estate agency_',
  ];
  if (mode === 'agent' && agentName) lines.push(`_Agent: ${agentName}_`);
  lines.push('');
  if (forSale.length) lines.push(`*For Sale (${forSale.length} properties)*`);
  if (forRent.length) lines.push(`*To Rent (${forRent.length} properties)*`);
  lines.push(`View my entire catalogue here: ${catalogueUrl}`);
  return lines.join('\n');
}

export async function createPropertyShareCard(property: Property): Promise<Blob> {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the share image.');

  const photoSources = [...new Set([
    property.coverImage,
    ...(property.photos ?? []),
  ].filter((photo): photo is string => Boolean(photo)))];
  const topPhotoHeight = Math.round((PHOTO_HEIGHT - 8) * 0.67);
  const lowerPhotoHeight = PHOTO_HEIGHT - topPhotoHeight - 8;
  const lowerPhotoWidth = (CANVAS_WIDTH - 8) / 2;
  await drawPhotoTile(ctx, photoSources[0], 0, 0, CANVAS_WIDTH, topPhotoHeight);
  await drawPhotoTile(ctx, photoSources[1] ?? photoSources[0], 0, topPhotoHeight + 8, lowerPhotoWidth, lowerPhotoHeight);
  await drawPhotoTile(ctx, photoSources[2] ?? photoSources[1] ?? photoSources[0], lowerPhotoWidth + 8, topPhotoHeight + 8, lowerPhotoWidth, lowerPhotoHeight);

  ctx.fillStyle = GREEN;
  ctx.fillRect(0, PHOTO_HEIGHT, CANVAS_WIDTH, 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, PHOTO_HEIGHT + 8, CANVAS_WIDTH, CANVAS_HEIGHT - PHOTO_HEIGHT - 8);

  const x = 54;
  const contentWidth = CANVAS_WIDTH - x * 2;
  let y = PHOTO_HEIGHT + 58;
  ctx.textAlign = 'left';
  ctx.fillStyle = GREEN;
  ctx.font = '800 28px Arial';
  ctx.fillText(listingTypeLabel(property.listingType).toUpperCase(), x, y);
  ctx.fillStyle = MUTED;
  ctx.font = '700 24px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(property.reference, CANVAS_WIDTH - x, y);
  ctx.textAlign = 'left';

  y += 66;
  ctx.fillStyle = NAVY;
  ctx.font = '800 48px Arial';
  y += drawText(ctx, formatPrice(property), x, y, contentWidth, 54, 1);

  ctx.fillStyle = MUTED;
  ctx.font = '600 30px Arial';
  y += 16;
  y += drawText(ctx, property.address && property.addressVisible
    ? `${property.address}, ${property.suburb}`
    : property.suburb, x, y, contentWidth, 38, 1);

  const stats = [
    property.bedrooms ? `${property.bedrooms} beds` : '',
    property.bathrooms ? `${property.bathrooms} baths` : '',
    property.parking ? `${property.parking} parking` : '',
  ].filter(Boolean).join('  ·  ');
  if (stats) {
    y += 24;
    ctx.fillStyle = NAVY;
    ctx.font = '700 26px Arial';
    y += drawText(ctx, stats, x, y, contentWidth, 32, 1);
  }

  if (property.description?.trim()) {
    y += 24;
    ctx.fillStyle = NAVY;
    ctx.font = '400 24px Arial';
    drawText(ctx, property.description.replace(/\s+/g, ' ').trim(), x, y, contentWidth, 32, 2);
  }

  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, CANVAS_HEIGHT - 112);
  ctx.lineTo(CANVAS_WIDTH - x, CANVAS_HEIGHT - 112);
  ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.font = '800 20px Arial';
  ctx.fillText('SEE FULL DETAILS ON QUICKPROP', x, CANVAS_HEIGHT - 68);
  ctx.fillStyle = MUTED;
  ctx.font = '700 19px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('QuickProp', CANVAS_WIDTH - x, CANVAS_HEIGHT - 68);

  return canvasToBlob(canvas);
}

export async function createCatalogueShareCard(
  properties: Property[],
  mode: 'company' | 'agent',
  agentName: string | undefined,
): Promise<Blob> {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the share image.');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 18);

  const x = 64;
  const contentWidth = CANVAS_WIDTH - x * 2;
  ctx.fillStyle = GREEN;
  ctx.font = '800 28px Arial';
  ctx.fillText('QUICKPROP', x, 92);
  ctx.fillStyle = NAVY;
  ctx.font = '800 58px Arial';
  const title = mode === 'agent' ? `${agentName?.split(' ')[0] ?? 'My'}'s Listings` : 'Property Brochure';
  let y = 174;
  y += drawText(ctx, title, x, y, contentWidth, 68, 2);
  ctx.fillStyle = MUTED;
  ctx.font = '500 28px Arial';
  y += 20;
  ctx.fillText('Your trusted Harare estate agency', x, y);

  const forSale = properties.filter(property => property.listingType === 'sale');
  const forRent = properties.filter(property => property.listingType === 'rent');
  y += 78;
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(x, y, contentWidth, 132);
  ctx.fillStyle = NAVY;
  ctx.font = '800 42px Arial';
  ctx.fillText(String(properties.length), x + 28, y + 58);
  ctx.fillStyle = MUTED;
  ctx.font = '600 23px Arial';
  ctx.fillText(properties.length === 1 ? 'property' : 'properties', x + 28, y + 96);
  ctx.fillStyle = GREEN;
  ctx.font = '700 24px Arial';
  ctx.fillText(`${forSale.length} for sale`, x + 300, y + 58);
  ctx.fillStyle = '#3B82F6';
  ctx.fillText(`${forRent.length} to rent`, x + 300, y + 96);

  y += 190;
  ctx.fillStyle = NAVY;
  ctx.font = '800 25px Arial';
  ctx.fillText('FEATURED LISTINGS', x, y);
  y += 44;
  properties.slice(0, 6).forEach(property => {
    ctx.fillStyle = BORDER;
    ctx.fillRect(x, y, contentWidth, 1);
    y += 34;
    ctx.fillStyle = NAVY;
    ctx.font = '700 25px Arial';
    const name = `${property.bedrooms ? `${property.bedrooms}-bed ` : ''}${property.propertyType} · ${property.suburb}`;
    ctx.fillText(name.slice(0, 48), x, y);
    ctx.fillStyle = GREEN;
    ctx.font = '700 23px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(formatPrice(property), CANVAS_WIDTH - x, y);
    ctx.textAlign = 'left';
    y += 42;
  });

  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, CANVAS_HEIGHT - 142);
  ctx.lineTo(CANVAS_WIDTH - x, CANVAS_HEIGHT - 142);
  ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.font = '800 21px Arial';
  ctx.fillText('SEE FULL DETAILS ON QUICKPROP', x, CANVAS_HEIGHT - 92);
  ctx.fillStyle = MUTED;
  ctx.font = '700 20px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('QuickProp', CANVAS_WIDTH - x, CANVAS_HEIGHT - 92);
  ctx.textAlign = 'left';

  return canvasToBlob(canvas);
}

export async function shareCardWithCaption(
  blob: Blob,
  caption: string,
  title: string,
  fileName: string,
  fallbackUrl?: string | null,
  openComposerDirectly = false,
): Promise<'shared' | 'downloaded'> {
  await navigator.clipboard?.writeText(caption).catch(() => {});
  const file = new File([blob], fileName, { type: 'image/jpeg' });
  const canShareFile = typeof navigator.share === 'function'
    && !openComposerDirectly
    && (!navigator.canShare || navigator.canShare({ files: [file] }));

  if (canShareFile) {
    await navigator.share({ files: [file], text: caption, title });
    return 'shared';
  }

  const imageUrl = URL.createObjectURL(blob);
  const download = document.createElement('a');
  download.href = imageUrl;
  download.download = fileName;
  download.click();
  window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);

  const targetUrl = fallbackUrl === undefined
    ? `https://wa.me/?text=${encodeURIComponent(caption)}`
    : fallbackUrl;
  if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
  return 'downloaded';
}

export function openShareWindow(): Window | null {
  const opened = window.open('', 'quickprop-social-share');
  if (!opened || opened === window) return null;
  opened.opener = null;
  return opened;
}

export async function openSocialShareLink(
  caption: string,
  targetUrl: string,
  shareWindow?: Window | null,
): Promise<boolean> {
  await navigator.clipboard?.writeText(caption).catch(() => {});
  const opened = shareWindow ?? window.open(targetUrl, '_blank', 'noopener,noreferrer');
  if (!opened || opened === window) return false;
  try {
    opened.location.href = targetUrl;
    return true;
  } catch {
    if (!opened.closed) opened.close();
    return false;
  }
}