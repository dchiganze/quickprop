import assert from 'node:assert/strict';
import test from 'node:test';
import {
  prepareShareImage, runNativeSocialShare, runPropertyFlyerShare, waitForShareModalDismissal,
} from '../artifacts/mobile/utils/socialShareFlow';

test('native flyer sharing captures first, dismisses the app modal, then shares the JPEG only', async () => {
  for (const platform of ['ios', 'android']) {
    const calls: string[] = [];
    await runPropertyFlyerShare({
      platform,
      capture: async () => { calls.push('capture'); return 'file:///flyer.jpg'; },
      beforeNativeShare: async () => { calls.push('dismiss'); },
      shareNative: async (...items) => {
        assert.deepEqual(items, ['file:///flyer.jpg']);
        calls.push('native');
      },
      shareWeb: async () => { assert.fail('Native flyer sharing must not open a browser composer'); },
    });
    assert.deepEqual(calls, ['capture', 'dismiss', 'native']);
  }
});

test('web receives the flyer file without attempting a native modal handoff', async () => {
  await runPropertyFlyerShare({
    platform: 'web',
    capture: async () => 'blob:flyer-image',
    beforeNativeShare: async () => { assert.fail('Web has no native modal'); },
    shareNative: async () => { assert.fail('Web must not use the native bridge'); },
    shareWeb: async (...items) => { assert.deepEqual(items, ['blob:flyer-image']); },
  });
});

test('failed capture or modal dismissal does not attempt a native handoff', async () => {
  for (const failure of ['capture', 'dismiss']) {
    let shared = false;
    await assert.rejects(runPropertyFlyerShare({
      platform: 'ios',
      capture: async () => {
        if (failure === 'capture') throw new Error('capture failed');
        return 'file:///flyer.jpg';
      },
      beforeNativeShare: async () => { if (failure === 'dismiss') throw new Error('dismiss failed'); },
      shareNative: async () => { shared = true; },
      shareWeb: async () => { shared = true; },
    }), new RegExp(`${failure} failed`));
    assert.equal(shared, false);
  }
});

test('cancelling or failing native sharing never opens a browser fallback', async () => {
  let browser = false;
  await assert.rejects(runPropertyFlyerShare({
    platform: 'ios', capture: async () => 'file:///flyer.jpg',
    shareNative: async () => { throw new Error('User cancelled'); },
    shareWeb: async () => { browser = true; },
  }), /User cancelled/);
  assert.equal(browser, false);
});

test('iOS opens the image chooser without calling the targeted social bridge', async () => {
  const calls: string[] = [];
  await runNativeSocialShare('ios', async () => { calls.push('chooser'); }, async () => { calls.push('targeted'); });
  assert.deepEqual(calls, ['chooser']);
});

test('Android retains direct sharing and falls back when the app is unavailable', async () => {
  const calls: string[] = [];
  await runNativeSocialShare('android', async () => { calls.push('chooser'); }, async () => { calls.push('targeted'); });
  assert.deepEqual(calls, ['targeted']);
  await runNativeSocialShare('android', async () => { calls.push('fallback'); }, async () => { throw new Error('Unavailable'); });
  assert.deepEqual(calls, ['targeted', 'fallback']);
});

test('cancelling a targeted share does not reopen another share dialog', async () => {
  let opened = false;
  for (const message of ['User cancelled', 'User did not share', 'Dismissed']) {
    await runNativeSocialShare('android', async () => { opened = true; }, async () => { throw new Error(message); });
  }
  assert.equal(opened, false);
});

test('stalled image preparation has a retryable error instead of a permanent spinner', async () => {
  await assert.rejects(prepareShareImage(() => new Promise(() => {}), 15), /took too long/);
  assert.equal(await prepareShareImage(async () => 'file:///flyer.jpg', 100), 'file:///flyer.jpg');
});

test('native handoff waits for the real modal dismissal', async () => {
  let finishDismiss: (() => void) | undefined;
  let resolved = false;
  const pending = waitForShareModalDismissal(done => { finishDismiss = done; }, 100);
  void pending.then(() => { resolved = true; });
  await Promise.resolve();
  assert.equal(resolved, false);
  finishDismiss?.();
  await pending;
  assert.equal(resolved, true);
});

test('failed modal dismissal stops sharing and propagates close errors', async () => {
  await assert.rejects(waitForShareModalDismissal(() => {}, 15), /could not close/);
  await assert.rejects(waitForShareModalDismissal(() => { throw new Error('Close failed'); }, 100), /Close failed/);
});
