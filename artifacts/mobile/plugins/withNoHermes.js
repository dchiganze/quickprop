const { withDangerousMod } = require('expo/config-plugins');
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

      fs.writeFileSync(podfilePath, noHermes);
      return config;
    },
  ]);
};

module.exports = withNoHermes;