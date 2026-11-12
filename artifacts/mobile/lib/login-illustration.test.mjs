import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('login screen uses the supplied illustration image', async () => {
  const [image, loginSource] = await Promise.all([
    readFile(new URL('../assets/images/quickprop-agent-illustration.png', import.meta.url)),
    readFile(new URL('../app/login.tsx', import.meta.url), 'utf8'),
  ]);

  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.match(loginSource, /source=\{require\('\.\.\/assets\/images\/quickprop-agent-illustration\.png'\)\}/);
  assert.match(loginSource, /resizeMode="cover"/);
  assert.doesNotMatch(loginSource, /SvgXml|welcomeIllustrationXml/);
});
