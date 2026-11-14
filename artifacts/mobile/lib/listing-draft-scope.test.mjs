import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgencyDraftQueryParams } from './listing-draft-scope.ts';

test('agency draft requests are limited to the agency listings scope', () => {
  assert.equal(buildAgencyDraftQueryParams('my', 'draft', '12'), undefined);
  assert.equal(buildAgencyDraftQueryParams('all', 'draft', '12'), undefined);
});

test('agency scope requests all same-agency drafts without an agent filter', () => {
  assert.deepEqual(buildAgencyDraftQueryParams('agency', 'draft', '12'), {
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

test('agency drafts are not queried while another status filter is active', () => {
  assert.equal(buildAgencyDraftQueryParams('agency', 'all', '12'), undefined);
  assert.equal(buildAgencyDraftQueryParams('agency', 'live', '12'), undefined);
});

test('agency draft requests require a numeric authenticated user id', () => {
  assert.equal(buildAgencyDraftQueryParams('agency', 'draft', undefined), undefined);
  assert.equal(buildAgencyDraftQueryParams('agency', 'draft', 'agent-12'), undefined);
});
