import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agencyListingsCacheKey,
  emptyAgencyListingsCache,
  mergeAgencyListingsCache,
  parseAgencyListingsCache,
} from './agency-listings-cache.ts';

const ownLive = { id: '1', status: 'published', photos: ['/objects/uploads/1/photo.jpg'] };
const agencyDraft = { id: '2', status: 'draft', photos: [] };

test('agency cache keys are account-scoped', () => {
  assert.notEqual(agencyListingsCacheKey('agent/one'), agencyListingsCacheKey('agent/two'));
  assert.match(agencyListingsCacheKey('agent/one'), /agent%2Fone$/);
});

test('parses live and draft snapshots only for the matching account', () => {
  const cache = mergeAgencyListingsCache(emptyAgencyListingsCache('agent-one'), 'agent-one', {
    agencyName: 'DBT Properties',
    agents: [{ id: '7', name: 'Agent Seven', detail: 'Harare' }],
    agentsSyncedAt: '2026-11-12T09:59:00.000Z',
    live: [ownLive],
    drafts: [agencyDraft],
    liveSyncedAt: '2026-11-12T10:00:00.000Z',
    draftsSyncedAt: '2026-11-12T10:01:00.000Z',
  });

  assert.deepEqual(
    parseAgencyListingsCache(JSON.stringify(cache), 'agent-one'),
    cache,
  );
  assert.equal(parseAgencyListingsCache(JSON.stringify(cache), 'agent-two'), null);
});

test('rejects malformed or unsupported cached data', () => {
  assert.equal(parseAgencyListingsCache('{', 'agent-one'), null);
  assert.equal(parseAgencyListingsCache(null, 'agent-one'), null);
  assert.equal(parseAgencyListingsCache(JSON.stringify({
    version: 99,
    userId: 'agent-one',
    live: [],
    drafts: [],
  }), 'agent-one'), null);
});

test('updates one listing collection without dropping the other', () => {
  const withLive = mergeAgencyListingsCache(emptyAgencyListingsCache('agent-one'), 'agent-one', {
    live: [ownLive],
    liveSyncedAt: '2026-11-12T10:00:00.000Z',
  });
  const withDrafts = mergeAgencyListingsCache(withLive, 'agent-one', {
    drafts: [agencyDraft],
    draftsSyncedAt: '2026-11-12T10:01:00.000Z',
  });

  assert.deepEqual(withDrafts.live, [ownLive]);
  assert.deepEqual(withDrafts.drafts, [agencyDraft]);
  assert.equal(withDrafts.liveSyncedAt, '2026-11-12T10:00:00.000Z');
  assert.equal(withDrafts.agencyName, null);
});

test('drops invalid rows rather than failing the whole cache', () => {
  const cache = emptyAgencyListingsCache('agent-one');
  const parsed = parseAgencyListingsCache(JSON.stringify({
    ...cache,
    live: [ownLive, { id: 'bad', photos: 'not-an-array' }],
    drafts: [agencyDraft],
  }), 'agent-one');

  assert.deepEqual(parsed?.live, [ownLive]);
  assert.deepEqual(parsed?.drafts, [agencyDraft]);
});
