const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withExpoPrintPod(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes('ExpoPrint')) {
        console.log('[withExpoPrintPod] ExpoPrint already present — skipping.');
        return config;
      }

      const candidates = [
        path.resolve(config.modRequest.projectRoot, 'node_modules', 'expo-print'),
        path.resolve(config.modRequest.projectRoot, '..', '..', 'node_modules', 'expo-print'),
      ];

      const found = candidates.find((p) => fs.existsSync(p));
      if (!found) {
        throw new Error('[withExpoPrintPod] Could not locate expo-print. Make sure expo-print is installed.');
      }

      const realPackageRoot = fs.realpathSync(found);
      const realIosDir = path.join(realPackageRoot, 'ios');

      if (!fs.existsSync(realIosDir)) {
        throw new Error(`[withExpoPrintPod] ios/ directory not found at ${realIosDir}`);
      }

      const relPath = path.relative(config.modRequest.platformProjectRoot, realIosDir);

      podfile = podfile.replace(
        'use_expo_modules!',
        `use_expo_modules!\n  pod 'ExpoPrint', :path => '${relPath}'`
      );

      fs.writeFileSync(podfilePath, podfile);
      console.log(`[withExpoPrintPod] Injected ExpoPrint pod at '${relPath}'.`);
      return config;
    },
  ]);
};