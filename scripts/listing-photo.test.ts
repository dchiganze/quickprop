import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrimaryListingPhoto, getStoredMediaObjectPath } from '../artifacts/mobile/utils/listingPhoto';

test('uses the first non-empty listing photo', () => {
  assert.equal(getPrimaryListingPhoto({ id: '35', photos: ['', '  ', ' file:///photo.jpg '] }), 'file:///photo.jpg');
  assert.equal(getPrimaryListingPhoto({ id: '35', photos: [] }), undefined);
});

test('resolves durable storage paths without retaining the original host or signed query', () => {
  const objectPath = '/objects/uploads/7/a123-b456.jpg';
  assert.equal(getStoredMediaObjectPath(`https://example.test/api/storage${objectPath}`), objectPath);
  assert.equal(getStoredMediaObjectPath(`${objectPath}?old=value`), objectPath);
  assert.equal(getStoredMediaObjectPath('file:///photo.jpg'), undefined);
  assert.equal(getStoredMediaObjectPath('https://example.test/photo.jpg'), undefined);
  assert.equal(getStoredMediaObjectPath('/objects/uploads/7/../../photo.jpg'), undefined);
});
