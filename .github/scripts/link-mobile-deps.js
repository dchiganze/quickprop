#!/usr/bin/env node
/**
 * Symlinks every dependency of artifacts/mobile into
 * artifacts/mobile/node_modules so Expo's plugin resolver (which uses
 * require.resolve relative to that directory) can find them.
 *
 * pnpm's virtual store puts packages at:
 *   node_modules/.pnpm/<escaped-name>@<version>_<peers>/node_modules/<name>
 *
 * Even with --shamefully-hoist, workspace-member-only packages are NOT
 * hoisted to the root node_modules, so we must search .pnpm directly.
 */

const fs   = require('fs');
const path = require('path');

const appJson = JSON.parse(fs.readFileSync('artifacts/mobile/app.json', 'utf8'));
const pkgJson = JSON.parse(fs.readFileSync('artifacts/mobile/package.json', 'utf8'));

// Collect every package that mobile needs
const wanted = new Set([
  ...Object.keys(pkgJson.dependencies  || {}),
  ...Object.keys(pkgJson.devDependencies || {}),
]);
for (const p of (appJson.expo.plugins || [])) {
  const name = Array.isArray(p) ? p[0] : p;
  if (!name.startsWith('.') && !name.startsWith('/')) wanted.add(name);
}

const mobileNm = path.resolve('artifacts/mobile/node_modules');
fs.mkdirSync(mobileNm, { recursive: true });

const pnpmDir     = path.resolve('node_modules/.pnpm');
const pnpmEntries = fs.readdirSync(pnpmDir);

let linked = 0, skipped = 0, missing = 0;

for (const pkgName of wanted) {
  // Scoped packages: @scope/name → dst dir needs @scope/ sub-dir
  const isScoped = pkgName.startsWith('@');
  const [scope, shortName] = isScoped ? pkgName.split('/') : [null, pkgName];
  const dstDir  = isScoped ? path.join(mobileNm, scope) : mobileNm;
  const dstName = isScoped ? shortName : pkgName;
  const dst     = path.join(dstDir, dstName);

  if (fs.existsSync(dst)) { skipped++; continue; }

  // 1. Try direct (works if shamefully-hoist actually hoisted it)
  const direct = path.resolve('node_modules', pkgName);
  if (fs.existsSync(direct)) {
    fs.mkdirSync(dstDir, { recursive: true });
    fs.symlinkSync(direct, dst, 'dir');
    console.log(`  linked (direct):  ${pkgName}`);
    linked++; continue;
  }

  // 2. Search pnpm virtual store
  // pnpm escapes scope separator: @scope/name → @scope+name@version...
  const pnpmKey = pkgName.replace('/', '+');
  const match   = pnpmEntries.find(e => e.startsWith(pnpmKey + '@'));

  if (match) {
    const src = path.join(pnpmDir, match, 'node_modules', pkgName);
    if (fs.existsSync(src)) {
      fs.mkdirSync(dstDir, { recursive: true });
      fs.symlinkSync(src, dst, 'dir');
      console.log(`  linked (pnpm):    ${pkgName}  ←  ${match}`);
      linked++; continue;
    }
  }

  console.warn(`  WARN: not found:  ${pkgName}`);
  missing++;
}

console.log(`\nDone. linked=${linked}  skipped=${skipped}  missing=${missing}`);
if (missing > 0) process.exit(1);