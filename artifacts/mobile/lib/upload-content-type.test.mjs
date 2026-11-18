import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveUploadContentType } from './upload-content-type.ts';

test('uses the file extension when Expo returns a generic blob type', () => {
  assert.equal(resolveUploadContentType('application/octet-stream', 'photo.HEIC', 'image'), 'image/heic');
  assert.equal(resolveUploadContentType('', 'listing-photo.png', 'image'), 'image/png');
  assert.equal(resolveUploadContentType('application/octet-stream', 'tour.mov', 'video'), 'video/quicktime');
});

test('preserves a valid MIME type returned by the picker', () => {
  assert.equal(resolveUploadContentType('image/webp; charset=binary', 'photo.jpg', 'image'), 'image/webp');
  assert.equal(resolveUploadContentType('video/webm', 'tour.mp4', 'video'), 'video/webm');
});

test('uses safe media defaults for files without recognizable extensions', () => {
  assert.equal(resolveUploadContentType('', 'media-cache-file', 'image'), 'image/jpeg');
  assert.equal(resolveUploadContentType('', 'media-cache-file', 'video'), 'video/mp4');
});
