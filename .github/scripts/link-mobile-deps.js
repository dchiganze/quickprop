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
fs.mkdirSync(mobileNm, { recursive: true });

const pnpmDir     = path.resolve('node_modules/.pnpm');
const pnpmEntries = fs.readdirSync(pnpmDir);

// DEBUG: show first few entries so we can verify the naming format
console.log('Sample .pnpm entries (first 5):');
pnpmEntries.slice(0, 5).forEach(function(e) { console.log('  ' + e); });

let linked = 0, skipped = 0, missing = 0;

for (const pkgName of wanted) {
  // Scoped packages: @scope/name → dst dir needs @scope/ sub-dir
  const isScoped   = pkgName.startsWith('@');
  const parts      = pkgName.split('/');
  const scope      = isScoped ? parts[0] : null;
  const shortName  = isScoped ? parts[1] : pkgName;
  const dstDir     = isScoped ? path.join(mobileNm, scope) : mobileNm;
  const dst        = path.join(dstDir, shortName);

  if (fs.existsSync(dst)) {
    skipped++;
  } else {
    // Strategy 1: direct (in case shamefully-hoist put it at root)
    const direct = path.resolve('node_modules', pkgName);
    if (fs.existsSync(direct)) {
      fs.mkdirSync(dstDir, { recursive: true });
      fs.symlinkSync(direct, dst, 'dir');
      console.log('  linked (direct):  ' + pkgName);
      linked++;
    } else {
      // Strategy 2: search pnpm virtual store
      // pnpm escapes / in scoped names: @scope/name → @scope+name
      const pnpmKey = pkgName.replace('/', '+');
      const matches = pnpmEntries.filter(function(e) {
        return e.startsWith(pnpmKey + '@');
      });

      var foundSrc = null;
      for (var i = 0; i < matches.length; i++) {
        var candidate = path.join(pnpmDir, matches[i], 'node_modules', pkgName);
        if (fs.existsSync(candidate)) {
          foundSrc = candidate;
          break;
        } else {
          console.log('  DEBUG ' + pkgName + ': matched "' + matches[i] + '" but inner path missing: ' + candidate);
        }
      }

      if (foundSrc) {
        fs.mkdirSync(dstDir, { recursive: true });
        fs.symlinkSync(foundSrc, dst, 'dir');
        console.log('  linked (pnpm):    ' + pkgName);
        linked++;
      } else {
        // DEBUG: show any fuzzy matches that contain the short name
        var fuzzy = pnpmEntries.filter(function(e) {
          return e.indexOf(shortName) !== -1;
        });
        console.warn('  WARN not found:   ' + pkgName + '  (fuzzy: ' + (fuzzy.slice(0, 3).join(', ') || 'none') + ')');
        missing++;
      }
    }
  }
}

console.log('\nDone. linked=' + linked + '  skipped=' + skipped + '  missing=' + missing);
if (missing > 0) {
  process.exit(1);
}
