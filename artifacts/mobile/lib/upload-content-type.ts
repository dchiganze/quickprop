const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  txt: 'text/plain',
  webm: 'video/webm',
  webp: 'image/webp',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function resolveUploadContentType(
  suppliedType: string | undefined,
  fileName: string,
  mediaKind: 'image' | 'video',
): string {
  const normalizedType = suppliedType?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaKind === 'image' && normalizedType?.startsWith('image/')) return normalizedType;
  if (mediaKind === 'video' && normalizedType?.startsWith('video/')) return normalizedType;

  const extension = fileName.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase() ?? '';
  const inferredType = MIME_BY_EXTENSION[extension];
  if (inferredType?.startsWith(`${mediaKind}/`)) return inferredType;
  return mediaKind === 'video' ? 'video/mp4' : 'image/jpeg';
}
