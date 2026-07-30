const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNoHermes = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Fix 1: disable Hermes
      const noHermes = contents.replace(
        /(:hermes_enabled\s*=>\s*)[^\n,)]+/g,
        '$1false'
      );

      if (noHermes === contents) {
        console.warn('[withNoHermes] Warning: :hermes_enabled not found in Podfile');
      } else {
        console.log('[withNoHermes] Patched Podfile: :hermes_enabled => false');
      }

      // Fix 2: FMT_USE_NONTYPE_TEMPLATE_ARGS=0 — fixes fmt consteval errors
      // under Xcode 16 / Apple Clang 16 (macos-latest GitHub Actions runner)
      const fmtHook = `
  # Fix fmt consteval errors under Xcode 16 / Apple Clang 16
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FMT_USE_NONTYPE_TEMPLATE_ARGS=0'
      flags = config.build_settings['OTHER_CPLUSPLUSFLAGS'] || '$(inherited)'
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] = flags + ' -DFMT_USE_NONTYPE_TEMPLATE_ARGS=0'
    end
  end
`;

      let patched = noHermes;

      if (patched.includes('post_install do |installer|')) {
        patched = patched.replace(
          /(post_install do \|installer\|[\s\S]*?)(^end)/m,
          `$1${fmtHook}$2`
        );
        console.log('[withNoHermes] Injected FMT fix into existing post_install block');
      } else {
        patched = patched + `\npost_install do |installer|\n${fmtHook}end\n`;
        console.log('[withNoHermes] Appended new post_install block with FMT fix');
      }

      fs.writeFileSync(podfilePath, patched);
      return config;
    },
  ]);
};

module.exports = withNoHermes;