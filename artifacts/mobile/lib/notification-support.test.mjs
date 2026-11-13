import test from 'node:test';
import assert from 'node:assert/strict';
import { supportsNativePushForRuntime } from './notification-support.ts';

test('keeps native push disabled in Expo Go', () => {
  assert.equal(supportsNativePushForRuntime('android', 'expo'), false);
  assert.equal(supportsNativePushForRuntime('ios', 'expo'), false);
});

test('allows native push in installed and bare apps', () => {
  assert.equal(supportsNativePushForRuntime('android', 'standalone'), true);
  assert.equal(supportsNativePushForRuntime('ios', 'standalone'), true);
  assert.equal(supportsNativePushForRuntime('ios', null), true);
});

test('does not enable native push on web', () => {
  assert.equal(supportsNativePushForRuntime('web', null), false);
});
