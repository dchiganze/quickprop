import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyOfflineListingsCache,
  offlineListingsCacheKey,
  parseOfflineListingsCache,
  removeOfflineListing,
  upsertOfflineListing,
} from './offline-listings-cache.ts';

const property = (id, photos = []) => ({
  id,
  referenceNumber: `QP-${id}`,
  title: `Home ${id}`,
  type: 'sale',
  status: 'published',
  address: 'Borrowdale',
  suburb: 'Borrowdale',
  price: 100000,
  currency: 'USD',
  negotiable: false,
  features: [],
  description: '',
  photos,
  seller: { name: '', phone: '', email: '', mandateExpiry: '', mandateType: 'open', notes: '' },
  agentId: '10',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
});

test('offline listing cache is account-scoped and rejects malformed data', () => {
  const cache = upsertOfflineListing(emptyOfflineListingsCache('agent/one'), 'agent/one', property('1'), 'now');
  assert.match(offlineListingsCacheKey('agent/one'), /agent%2Fone$/);
  assert.equal(parseOfflineListingsCache(JSON.stringify(cache), 'agent/one')?.properties.length, 1);
  assert.equal(parseOfflineListingsCache(JSON.stringify(cache), 'agent/two'), null);
  assert.equal(parseOfflineListingsCache('{', 'agent/one'), null);
});

test('offline listing upsert replaces one snapshot and removal returns its media references', () => {
  const one = property('1', ['file://one.jpg']);
  const two = property('2', ['file://two.jpg']);
  const saved = upsertOfflineListing(upsertOfflineListing(null, 'agent', one, 'a'), 'agent', two, 'b');
  const refreshed = upsertOfflineListing(saved, 'agent', property('1', ['file://new.jpg']), 'c');

  assert.deepEqual(refreshed.properties.map((item) => item.id), ['1', '2']);
  assert.deepEqual(refreshed.properties[0].photos, ['file://new.jpg']);
  const removed = removeOfflineListing(refreshed, 'agent', '1', 'd');
  assert.deepEqual(removed.removed?.photos, ['file://new.jpg']);
  assert.deepEqual(removed.cache.properties.map((item) => item.id), ['2']);
});
