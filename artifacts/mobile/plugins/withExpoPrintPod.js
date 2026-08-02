const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withExpoPrintPod(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes('EXPrint')) {
        console.log('[withExpoPrintPod] EXPrint already present — skipping.');
        return config;
      }

      // Point at the package root — that's where EXPrint.podspec lives.
      const candidates = [
        path.resolve(config.modRequest.projectRoot, 'node_modules', 'expo-print'),
        path.resolve(config.modRequest.projectRoot, '..', '..', 'node_modules', 'expo-print'),
      ];

      const found = candidates.find((p) => fs.existsSync(p));
      if (!found) {
        throw new Error('[withExpoPrintPod] Could not locate expo-print. Make sure expo-print is installed.');
      }

      const realFound = fs.realpathSync(found);
      const relPath = path.relative(config.modRequest.platformProjectRoot, realFound);

      podfile = podfile.replace(
        'use_expo_modules!',
        `use_expo_modules!\n  pod 'EXPrint', :path => '${relPath}'`
      );

      fs.writeFileSync(podfilePath, podfile);
      console.log(`[withExpoPrintPod] Injected EXPrint pod at '${relPath}'.`);
      return config;
    },
  ]);
};