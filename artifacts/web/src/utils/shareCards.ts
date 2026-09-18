type ShareProperty = {
  title: string;
  reference: string;
  description?: string | null;
  listingType: string;
  price: number;
  currency: string;
  negotiable?: boolean;
  suburb: string;
  address?: string | null;
  addressVisible?: boolean;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  photos?: string[];
  coverImage?: string | null;
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080;
const COLLAGE_HEIGHT = 760;
const GREEN = '#10B981';
const NAVY = '#0B1929';
const MUTED = '#64748B';

function formatPrice(property: Pick<ShareProperty, 'price' | 'currency' | 'listingType'>): string {
  const amount = property.price >= 1_000_000
    ? `${(property.price / 1_000_000).toFixed(1)}M`
    : property.price.toLocaleString();
  return `${property.currency} ${amount}${property.listingType === 'rent' ? '/month' : ''}`;
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

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = GREEN;
  ctx.font = '800 44px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('QuickProp', x + width / 2, y + height / 2 - 8);
  ctx.fillStyle = MUTED;
  ctx.font = '600 24px Arial';
  ctx.fillText('Photo unavailable', x + width / 2, y + height / 2 + 36);
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
    drawPlaceholder(ctx, x, y, width, height);
    return;
  }

  try {
    drawCoverImage(ctx, await loadImage(source), x, y, width, height);
  } catch {
    drawPlaceholder(ctx, x, y, width, height);
  }
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
  property: ShareProperty,
  publicUrl: string,
  catalogueUrl: string,
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
    property.title,
    `📍 ${location}`,
    `💰 ${formatPrice(property)}${property.negotiable ? ' (Negotiable)' : ''}`,
  ];
  if (stats) lines.push(stats);
  if (property.description?.trim()) lines.push(property.description.replace(/\s+/g, ' ').trim());
  lines.push(`📋 Ref: ${property.reference}`);
  lines.push(`View my entire catalogue here: ${catalogueUrl}`);
  lines.push(`View this property: ${publicUrl}`);
  return lines.join('\n');
}

export async function createPropertyShareCard(property: ShareProperty): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the share image.');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const photoSources = [...new Set([
    property.coverImage,
    ...(property.photos ?? []),
  ].filter((photo): photo is string => Boolean(photo)))];
  const topPhotoHeight = Math.round((COLLAGE_HEIGHT - 8) * 0.67);
  const lowerPhotoHeight = COLLAGE_HEIGHT - topPhotoHeight - 8;
  const lowerPhotoWidth = (CANVAS_WIDTH - 8) / 2;
  await drawPhotoTile(ctx, photoSources[0], 0, 0, CANVAS_WIDTH, topPhotoHeight);
  await drawPhotoTile(ctx, photoSources[1] ?? photoSources[0], 0, topPhotoHeight + 8, lowerPhotoWidth, lowerPhotoHeight);
  await drawPhotoTile(ctx, photoSources[2] ?? photoSources[1] ?? photoSources[0], lowerPhotoWidth + 8, topPhotoHeight + 8, lowerPhotoWidth, lowerPhotoHeight);

  ctx.fillStyle = GREEN;
  ctx.fillRect(0, COLLAGE_HEIGHT, CANVAS_WIDTH, 8);
  ctx.fillStyle = NAVY;
  ctx.font = '800 40px Arial';
  ctx.fillText(property.title.slice(0, 46), 48, COLLAGE_HEIGHT + 72);
  ctx.fillStyle = MUTED;
  ctx.font = '600 28px Arial';
  ctx.fillText(`${property.reference} · ${formatPrice(property)}`, 48, COLLAGE_HEIGHT + 120);
  ctx.fillStyle = GREEN;
  ctx.font = '800 24px Arial';
  ctx.fillText('QUICKPROP', 48, CANVAS_HEIGHT - 42);

  return canvasToBlob(canvas);
}

export async function shareCardWithCaption(
  blob: Blob,
  caption: string,
  title: string,
  fileName: string,
  fallbackUrl?: string | null,
): Promise<'shared' | 'downloaded'> {
  await navigator.clipboard?.writeText(caption).catch(() => {});
  const file = new File([blob], fileName, { type: 'image/jpeg' });
  const canShareFile = typeof navigator.share === 'function'
    && (!navigator.canShare || navigator.canShare({ files: [file] }));

  if (canShareFile) {
    await navigator.share({ files: [file], text: caption, title });
    return 'shared';
  }

  const imageUrl = URL.createObjectURL(blob);
  const download = document.createElement('a');
  download.href = imageUrl;
  download.download = fileName;
  document.body.appendChild(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
  if (fallbackUrl) window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
  return 'downloaded';
}