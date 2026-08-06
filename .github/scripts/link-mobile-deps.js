#!/usr/bin/env node
/**
 * Symlinks every dependency of artifacts/mobile into
 * artifacts/mobile/node_modules so Expo's plugin resolver (which uses
 * require.resolve relative to that directory) can find them.
 */

const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const appJson = JSON.parse(fs.readFileSync('artifacts/mobile/app.json', 'utf8'));
const pkgJson = JSON.parse(fs.readFileSync('artifacts/mobile/package.json', 'utf8'));

// Collect every package that mobile needs
const wanted = new Set([
  ...Object.keys(pkgJson.dependencies   || {}),
  ...Object.keys(pkgJson.devDependencies || {}),
]);
for (const p of (appJson.expo.plugins || [])) {
  const name = Array.isArray(p) ? p[0] : p;
  if (!name.startsWith('.') && !name.startsWith('/')) {
    wanted.add(name);
  }
}

const mobileNm = path.resolve('artifacts/mobile/node_modules');
const repoRoot = process.cwd();
fs.mkdirSync(mobileNm, { recursive: true });

/**
 * Find a package directory using multiple strategies.
 * Returns absolute path to the package root, or null.
 */
function findPkg(pkgName) {
  // 1. require.resolve from repo root
  try {
    var r = require.resolve(pkgName + '/package.json', { paths: [repoRoot] });
    return path.dirname(r);
  } catch (_) {}

  // 2. require.resolve the main entry and walk up to package root
  try {
    var r2 = require.resolve(pkgName, { paths: [repoRoot] });
    var dir = path.dirname(r2);
    while (dir !== path.dirname(dir)) {
      var pjPath = path.join(dir, 'package.json');
      if (fs.existsSync(pjPath)) {
        try {
          var pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
          if (pj.name === pkgName) return dir;
        } catch (_) {}
      }
      dir = path.dirname(dir);
    }
  } catch (_) {}

  // 3. find command across all of node_modules (handles hashed pnpm dirs)
  try {
    var result = execSync(
      'find node_modules -name "package.json" -not -path "*/node_modules/*/node_modules/*" 2>/dev/null | xargs grep -l \'"name": "' + pkgName + '"\' 2>/dev/null | head -1',
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
    if (result) return path.dirname(result);
  } catch (_) {}

  return null;
}

let linked = 0, skipped = 0, missing = 0;

for (const pkgName of wanted) {
  const isScoped  = pkgName.startsWith('@');
  const parts     = pkgName.split('/');
  const scope     = isScoped ? parts[0] : null;
  const shortName = isScoped ? parts[1] : pkgName;
  const dstDir    = isScoped ? path.join(mobileNm, scope) : mobileNm;
  const dst       = path.join(dstDir, shortName);

  if (fs.existsSync(dst)) {
    skipped++;
  } else {
    var pkgDir = findPkg(pkgName);
    if (pkgDir) {
      fs.mkdirSync(dstDir, { recursive: true });
      fs.symlinkSync(pkgDir, dst, 'dir');
      console.log('  linked: ' + pkgName);
      linked++;
    } else {
      console.warn('  WARN not found: ' + pkgName);
      missing++;
    }
  }
}

console.log('\nDone. linked=' + linked + '  skipped=' + skipped + '  missing=' + missing);
if (missing > 0) {
  process.exit(1);
}
