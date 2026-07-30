const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Two fixes applied to the generated iOS Podfile:
 *
 * 1. Hermes disabled — replaces :hermes_enabled => <any> with false so the
 *    app runs on JavaScriptCore instead of Hermes (which crashes on iOS 26).
 *
 * 2. fmt consteval fix — injects FMT_USE_NONTYPE_TEMPLATE_ARGS=0 into the
 *    FIRST line of the existing post_install block (right after the opening
 *    "post_install do |installer|" line).  CocoaPods only allows one
 *    post_install block, so we must inject rather than append.
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

      // Fix 1: disable Hermes
      const noHermes = contents.replace(
        /(:hermes_enabled\s*=>\s*)[^\n,)]+/g,
        '$1false'
      );

      if (noHermes === contents) {
        console.warn(
          '[withNoHermes] Warning: :hermes_enabled not found in Podfile'
        );
      } else {
        console.log('[withNoHermes] Patched Podfile: :hermes_enabled => false');
      }

      // Fix 2: inject fmt fix into the existing post_install block.
      // We inject immediately after "post_install do |installer|" so we
      // never have to locate the matching `end` — safe against any indentation.
      const fmtInjection = [
        '  # Fix: fmt consteval errors under Xcode 16 / Apple Clang 16 (macos-latest)',
        '  installer.pods_project.targets.each do |target|',
        '    target.build_configurations.each do |build_config|',
        "      existing = build_config.build_settings['OTHER_CPLUSPLUSFLAGS'] || '$(inherited)'",
        "      unless existing.include?('FMT_USE_NONTYPE_TEMPLATE_ARGS=0')",
        "        build_config.build_settings['OTHER_CPLUSPLUSFLAGS'] = existing + ' -DFMT_USE_NONTYPE_TEMPLATE_ARGS=0'",
        '      end',
        '    end',
        '  end',
      ].join('\n');

      // Match the post_install opening line (handles any whitespace / variable name)
      const postInstallPattern = /(post_install do \|[^|]+\|[ \t]*\n)/;

      let patched;
      if (postInstallPattern.test(noHermes)) {
        patched = noHermes.replace(
          postInstallPattern,
          `$1${fmtInjection}\n`
        );
        console.log('[withNoHermes] Injected fmt consteval fix into post_install block');
      } else {
        // Fallback: no post_install found — this should not happen in RN 0.81
        console.warn(
          '[withNoHermes] Warning: post_install block not found; fmt fix NOT applied'
        );
        patched = noHermes;
      }

      fs.writeFileSync(podfilePath, patched);
      return config;
    },
  ]);
};

module.exports = withNoHermes;
