const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Forcibly disables Hermes in the generated iOS Podfile.
 *
 * Hermes (React Native's default JS engine) crashes on iOS 26.
 * This plugin runs after expo prebuild generates ios/Podfile and
 * replaces every :hermes_enabled assignment with false, regardless
 * of whatever app.json / eas.json / env vars resolved to.
 * The app runs on JavaScriptCore (the iOS system framework) instead.
 */
const withNoHermes = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Replace :hermes_enabled => <any value> with :hermes_enabled => false
      // The generated value is typically a long Ruby boolean expression.
      const patched = contents.replace(
        /(:hermes_enabled\s*=>\s*)[^\n,)]+/g,
        '$1false'
      );

      if (patched === contents) {
        console.warn(
          '[withNoHermes] Warning: :hermes_enabled not found in Podfile — ' +
          'check that expo prebuild has run and the Podfile is present.'
        );
      } else {
        console.log('[withNoHermes] Patched Podfile: :hermes_enabled => false');
      }

      fs.writeFileSync(podfilePath, patched);
      return config;
    },
  ]);
};

module.exports = withNoHermes;
