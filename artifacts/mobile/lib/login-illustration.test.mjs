import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { welcomeIllustrationXml } from '../constants/loginIllustration.ts';

test('login artwork removes the face discoloration while keeping the beard and skin', async () => {
  const source = await readFile(
    new URL('../assets/images/quickprop-welcome-illustration.svg', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /m49\.91 26\.06|m58\.79 19\.02|#A698B8/);
  assert.doesNotMatch(welcomeIllustrationXml, /m49\.91 26\.06|m58\.79 19\.02|#A698B8/);
  assert.match(source, /m60\.07 24\.55/);
  assert.match(welcomeIllustrationXml, /m60\.07 24\.55/);
  assert.match(source, /M60\.2 13\.7c1\.42/);
  assert.match(welcomeIllustrationXml, /M60\.2 13\.7c1\.42/);
  assert.match(source, /M65\.1 21\.6c\.9\.5/);
  assert.match(welcomeIllustrationXml, /M65\.1 21\.6c\.9\.5/);
  assert.match(welcomeIllustrationXml, /fill="#0D2D5D"/);
  assert.match(welcomeIllustrationXml, /fill="#B35B33"/);
});
