const MIME_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mov: "video/quicktime",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  txt: "text/plain",
  webm: "video/webm",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function resolveUploadContentType(name: string, suppliedType: unknown): string {
  const normalizedType = typeof suppliedType === "string"
    ? suppliedType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
    : "";
  if (
    normalizedType &&
    normalizedType !== "application/octet-stream" &&
    normalizedType !== "binary/octet-stream"
  ) {
    return normalizedType;
  }
  const extension = name.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? normalizedType;
}
