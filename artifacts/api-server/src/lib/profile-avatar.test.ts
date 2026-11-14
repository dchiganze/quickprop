import assert from "node:assert/strict";
import { test } from "node:test";
import { isOwnUploadedProfileAvatarUrl } from "./profile-avatar";

const avatarUrl = (userId: number, extension = "jpg") =>
  `https://www.quickprop.co.zw/api/storage/objects/uploads/${userId}/123e4567-e89b-12d3-a456-426614174000.${extension}`;

test("profile avatar URLs must be HTTPS images uploaded to the signed-in agent's storage path", () => {
  assert.equal(isOwnUploadedProfileAvatarUrl(avatarUrl(42), 42), true);
  assert.equal(isOwnUploadedProfileAvatarUrl(avatarUrl(42, "heic"), 42), true);
  assert.equal(isOwnUploadedProfileAvatarUrl(avatarUrl(43), 42), false);
  assert.equal(isOwnUploadedProfileAvatarUrl(avatarUrl(42).replace("https:", "http:"), 42), false);
  assert.equal(isOwnUploadedProfileAvatarUrl("https://images.example/profile.jpg", 42), false);
  assert.equal(isOwnUploadedProfileAvatarUrl(`${avatarUrl(42)}?tracking=1`, 42), false);
  assert.equal(isOwnUploadedProfileAvatarUrl(avatarUrl(42, "svg"), 42), false);
});
