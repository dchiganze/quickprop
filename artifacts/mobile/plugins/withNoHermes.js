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

      const noHermes = contents.replace(
        /(:hermes_enabled\s*=>\s*)[^\n,)]+/g,
        '$1false'
      );

      if (noHermes === contents) {
        console.warn('[withNoHermes] Warning: :hermes_enabled not found in Podfile');
      } else {
        console.log('[withNoHermes] Patched Podfile: :hermes_enabled => false');
      }

      const fmtBlock = `
# Fix: fmt consteval errors under Xcode 16 / Apple Clang 16 (macos-latest)
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |build_config|
      existing = build_config.build_settings['OTHER_CPLUSPLUSFLAGS'] || '$(inherited)'
      unless existing.include?('FMT_USE_NONTYPE_TEMPLATE_ARGS=0')
        build_config.build_settings['OTHER_CPLUSPLUSFLAGS'] = existing + ' -DFMT_USE_NONTYPE_TEMPLATE_ARGS=0'
      end
    end
  end
end
`;

      const patched = noHermes + fmtBlock;
      console.log('[withNoHermes] Appended fmt consteval fix post_install block');

      fs.writeFileSync(podfilePath, patched);
      return config;
    },
  ]);
};

module.exports = withNoHermes;