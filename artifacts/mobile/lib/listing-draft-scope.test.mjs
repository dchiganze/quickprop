import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgencyDraftQueryParams, mergeAgencyListings } from './listing-draft-scope.ts';

test('agency draft requests are limited to the agency listings scope', () => {
  assert.equal(buildAgencyDraftQueryParams('my', 'draft', '12'), undefined);
  assert.equal(buildAgencyDraftQueryParams('all', 'draft', '12'), undefined);
});

test('agency drafts are requested for both draft-only and all-status views', () => {
  const expected = {
    status: 'draft',
    agencyInventory: 'agency',
  };
  assert.deepEqual(buildAgencyDraftQueryParams('agency', 'draft', '12'), expected);
  assert.deepEqual(buildAgencyDraftQueryParams('agency', 'all', '12'), expected);
});

test('agency scope requests all same-agency drafts without an agent filter', () => {
  assert.deepEqual(buildAgencyDraftQueryParams('agency', 'all', '12'), {
    status: 'draft',
    agencyInventory: 'agency',
  });
});

test('an agent filter narrows agency drafts without changing the agency boundary', () => {
  assert.deepEqual(buildAgencyDraftQueryParams('agency', 'draft', '12', 34), {
    status: 'draft',
    agencyInventory: 'agency',
    agentId: 34,
  });
});

test('agency drafts are not queried while only live listings are requested', () => {
  assert.equal(buildAgencyDraftQueryParams('agency', 'live', '12'), undefined);
});

test('agency draft requests require a numeric authenticated user id', () => {
  assert.equal(buildAgencyDraftQueryParams('agency', 'all', undefined), undefined);
  assert.equal(buildAgencyDraftQueryParams('agency', 'all', 'agent-12'), undefined);
});

test('the all-status agency view merges live listings with drafts without duplicates', () => {
  const live = [{ id: '1', status: 'published' }, { id: '2', status: 'published' }];
  const drafts = [{ id: '2', status: 'draft' }, { id: '3', status: 'draft' }];

  assert.deepEqual(mergeAgencyListings(live, drafts), [
    { id: '1', status: 'published' },
    { id: '2', status: 'draft' },
    { id: '3', status: 'draft' },
  ]);
});
