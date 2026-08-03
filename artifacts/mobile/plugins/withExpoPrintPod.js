const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const DEPLOY_TARGET = '16.4';

const POST_INSTALL_SNIPPET = `
  # ---- withExpoPrintPod: force deployment target >= 16.4 for all pods ----
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      dt = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      if dt.nil? || dt.to_f < 16.4
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'
      end
    end
  end
  # ---- end withExpoPrintPod ----
`;

module.exports = function withExpoPrintPod(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Step 1: force platform line
      const platformBefore = podfile.match(/^platform :ios,.+$/m)?.[0] ?? '(not found)';
      podfile = podfile.replace(
        /^platform :ios,\s*.+$/m,
        `platform :ios, '${DEPLOY_TARGET}'`
      );
      console.log(`[withExpoPrintPod] platform: "${platformBefore}" → "platform :ios, '${DEPLOY_TARGET}'"`);

      // Step 2: inject post_install hook to force IPHONEOS_DEPLOYMENT_TARGET on all targets
      if (!podfile.includes('withExpoPrintPod: force deployment target')) {
        podfile = podfile.replace(
          /^(post_install do \|installer\|)/m,
          `$1${POST_INSTALL_SNIPPET}`
        );
        console.log('[withExpoPrintPod] Injected post_install deployment target fix.');
      }

      // Step 3: inject ExpoPrint pod
      if (podfile.includes('ExpoPrint')) {
        console.log('[withExpoPrintPod] ExpoPrint already present — skipping pod injection.');
        fs.writeFileSync(podfilePath, podfile);
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
        throw new Error(`[withExpoPrintPod] ios/ not found at ${realIosDir}`);
      }

      const relPath = path.relative(
        config.modRequest.platformProjectRoot,
        realIosDir
      );

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