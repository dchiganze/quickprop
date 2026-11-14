const PROFILE_AVATAR_PATH = /^\/api\/storage\/objects\/uploads\/(\d+)\/[a-f0-9-]{36}\.(?:jpe?g|png|webp|heic|gif)$/i;

export function isOwnUploadedProfileAvatarUrl(value: string, userId: number): boolean {
  if (!Number.isSafeInteger(userId) || userId < 1) return false;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return false;
    }

    const match = url.pathname.match(PROFILE_AVATAR_PATH);
    return Boolean(match && Number(match[1]) === userId);
  } catch {
    return false;
  }
}
