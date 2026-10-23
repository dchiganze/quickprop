import assert from 'node:assert/strict';
import test from 'node:test';
import { openLinkedInPreviewShare, prepareShareImage, runNativeSocialShare, waitForShareModalDismissal } from '../artifacts/mobile/utils/socialShareFlow';

test('LinkedIn validates the public preview, dismisses the modal, then opens its own composer', async () => {
  const calls: string[] = [];
  const previewUrl = 'https://www.quickprop.melios.co.zw/api/share/properties/DEMO-SHARE-DOUGLAS?v=2';
  await openLinkedInPreviewShare(previewUrl, {
    validatePreview: async url => { assert.equal(url, previewUrl); calls.push('validate'); },
    beforeOpen: async () => { calls.push('dismiss'); },
    openUrl: async url => {
      const composer = new URL(url);
      assert.equal(composer.origin, 'https://www.linkedin.com');
      assert.equal(composer.pathname, '/sharing/share-offsite/');
      assert.equal(composer.searchParams.get('url'), previewUrl);
      calls.push('composer');
    },
  });
  assert.deepEqual(calls, ['validate', 'dismiss', 'composer']);
});

test('LinkedIn does not open a composer for an unavailable preview or failed modal dismissal', async () => {
  let opened = false;
  const openUrl = async () => { opened = true; };
  await assert.rejects(openLinkedInPreviewShare('https://example.com/preview', {
    validatePreview: async () => { throw new Error('Preview unavailable'); },
    openUrl,
  }), /Preview unavailable/);
  await assert.rejects(openLinkedInPreviewShare('https://example.com/preview', {
    validatePreview: async () => {},
    beforeOpen: async () => { throw new Error('Modal still open'); },
    openUrl,
  }), /Modal still open/);
  assert.equal(opened, false);
});

test('LinkedIn supports web without modal dismissal and reports URL-opening failures', async () => {
  await assert.rejects(openLinkedInPreviewShare('https://example.com/preview', {
    validatePreview: async () => {},
    openUrl: async () => { throw new Error('Browser unavailable'); },
  }), /Browser unavailable/);
});

test('iOS opens the system chooser without calling the targeted social bridge', async () => {
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
  let chooserOpened = false;
  for (const message of ['User cancelled', 'User did not share', 'Dismissed']) {
    await runNativeSocialShare('android', async () => { chooserOpened = true; }, async () => { throw new Error(message); });
  }
  assert.equal(chooserOpened, false);
});

test('stalled image preparation fails with a retryable error instead of waiting forever', async () => {
  await assert.rejects(prepareShareImage(() => new Promise(() => {}), 15), /took too long/);
  assert.equal(await prepareShareImage(async () => 'file:///card.jpg', 100), 'file:///card.jpg');
});

test('capture and chooser errors propagate so the UI can clear loading and show the cause', async () => {
  await assert.rejects(prepareShareImage(async () => { throw new Error('Capture failed'); }), /Capture failed/);
  await assert.rejects(runNativeSocialShare('ios', async () => { throw new Error('Chooser unavailable'); }, async () => {}), /Chooser unavailable/);
});

test('native sharing waits until the app modal actually finishes dismissing', async () => {
  const calls: string[] = [];
  let didDismiss: (() => void) | undefined;
  const handoff = waitForShareModalDismissal((done) => {
    calls.push('close modal');
    didDismiss = done;
  }).then(() => runNativeSocialShare('ios', async () => { calls.push('open chooser'); }, async () => { calls.push('targeted'); }));
  await Promise.resolve();
  assert.deepEqual(calls, ['close modal']);
  didDismiss?.();
  await handoff;
  assert.deepEqual(calls, ['close modal', 'open chooser']);
});

test('failed modal dismissal stops the handoff instead of opening another native panel', async () => {
  let opened = false;
  await assert.rejects(
    waitForShareModalDismissal(() => {}, 15).then(() => { opened = true; }),
    /sharing window could not close/,
  );
  assert.equal(opened, false);
});

test('modal close errors propagate and do not trigger a handoff', async () => {
  await assert.rejects(waitForShareModalDismissal(() => { throw new Error('Close failed'); }), /Close failed/);
});
