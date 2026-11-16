import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildServerPropertyUpdatePatch,
  legacyStatusPatch,
  mergeMobilePropertyUpdates,
} from './property-sync.ts';

test('a mobile status edit patches the latest listing without sending stale fields', () => {
  const latestOnline = {
    title: 'Updated online title',
    status: 'draft',
    pipelineStage: 'draft',
    price: 350000,
  };
  const patch = buildServerPropertyUpdatePatch(latestOnline, { status: 'draft' });

  assert.deepEqual(patch, { status: 'draft', pipelineStage: 'draft' });
  assert.equal('title' in patch, false);
  assert.equal('price' in patch, false);
});

test('a merge keeps unrelated online edits and applies the mobile-edited fields', () => {
  const latestOnline = { title: 'Updated online title', status: 'published', price: 350000 };
  const merged = mergeMobilePropertyUpdates(latestOnline, { status: 'draft' });

  assert.deepEqual(merged, { title: 'Updated online title', status: 'draft', price: 350000 });
});

test('a legacy conflict can recover a locally changed draft status only', () => {
  assert.equal(legacyStatusPatch('draft', 'published'), 'draft');
  assert.equal(legacyStatusPatch('draft', 'draft'), null);
});

test('mobile property fields map to their server fields', () => {
  const completeServerProperty = {
    photos: ['new-photo.jpg'],
    coverImage: 'new-photo.jpg',
    sellerName: 'Farai',
    sellerPhone: '0770000000',
    sellerEmail: 'farai@example.com',
    sellerNotes: 'Call after 2pm',
    mandateType: 'sole',
    mandateExpiry: '2026-12-31',
    title: 'Current title',
    latitude: -17.8,
    longitude: 31.0,
  };
  const patch = buildServerPropertyUpdatePatch(completeServerProperty, {
    photos: [],
    seller: {},
    coordinates: {},
  });

  assert.deepEqual(patch, {
    photos: ['new-photo.jpg'],
    coverImage: 'new-photo.jpg',
    sellerName: 'Farai',
    sellerPhone: '0770000000',
    sellerEmail: 'farai@example.com',
    sellerNotes: 'Call after 2pm',
    mandateType: 'sole',
    mandateExpiry: '2026-12-31',
    latitude: -17.8,
    longitude: 31.0,
  });
  assert.equal('title' in patch, false);
});

test('status and availability edits include both server-side status fields', () => {
  const patch = buildServerPropertyUpdatePatch(
    { status: 'archived', pipelineStage: 'archived' },
    { status: 'archived', availabilityStatus: 'withdrawn' },
  );

  assert.deepEqual(patch, {
    status: 'archived',
    pipelineStage: 'archived',
    availabilityStatus: 'withdrawn',
  });
});
