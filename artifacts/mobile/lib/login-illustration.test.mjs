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
  assert.match(source, /M64\.6 21\.2C66\.2 22\.2/);
  assert.match(welcomeIllustrationXml, /M64\.6 21\.2C66\.2 22\.2/);
  assert.match(source, /M68\.6 24\.9c1\.2\.4/);
  assert.match(welcomeIllustrationXml, /M68\.6 24\.9c1\.2\.4/);
  assert.match(source, /M71\.6 25\.8c\.7\.1/);
  assert.match(welcomeIllustrationXml, /M71\.6 25\.8c\.7\.1/);
  assert.match(source, /M68\.8 21\.9c\.9\.2/);
  assert.match(welcomeIllustrationXml, /M68\.8 21\.9c\.9\.2/);
  assert.match(welcomeIllustrationXml, /fill="#0D2D5D"/);
  assert.match(welcomeIllustrationXml, /fill="#B35B33"/);
});
