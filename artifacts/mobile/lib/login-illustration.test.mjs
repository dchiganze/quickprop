import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('login screen uses the optimized ring-free illustration', async () => {
  const [image, placeholder, loginSource] = await Promise.all([
    readFile(new URL('../assets/images/quickprop-agent-illustration-3x.webp', import.meta.url)),
    readFile(new URL('../assets/images/quickprop-agent-illustration-placeholder.png', import.meta.url)),
    readFile(new URL('../app/login.tsx', import.meta.url), 'utf8'),
  ]);

  assert.equal(image.subarray(0, 4).toString(), 'RIFF');
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  assert.ok(image.length < 200_000, 'optimized image should stay lightweight');
  assert.equal(placeholder.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.match(loginSource, /source=\{require\('\.\.\/assets\/images\/quickprop-agent-illustration-3x\.webp'\)\}/);
  assert.match(loginSource, /placeholder=\{require\('\.\.\/assets\/images\/quickprop-agent-illustration-placeholder\.png'\)\}/);
  assert.match(loginSource, /illoWrap: \{ backgroundColor: 'transparent'/);
  assert.match(loginSource, /contentFit="cover"/);
  assert.match(loginSource, /cachePolicy="memory-disk"/);
  assert.match(loginSource, /priority="high"/);
  assert.doesNotMatch(loginSource, /SvgXml|welcomeIllustrationXml/);
});
