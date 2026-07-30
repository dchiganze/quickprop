const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Two fixes applied to the generated iOS Podfile:
 *
 * 1. Hermes disabled — replaces :hermes_enabled => <any> with false so the
 *    app runs on JavaScriptCore instead of Hermes (which crashes on iOS 26).
 *
 * 2. fmt consteval fix — injects FMT_USE_NONTYPE_TEMPLATE_ARGS=0 via
 *    GCC_PREPROCESSOR_DEFINITIONS on the `fmt` pod target specifically.
 *    Injected at the END of the existing post_install block (after the last
 *    non-`end` line) so Expo's react_native_post_install cannot overwrite it.
 *    Uses GCC_PREPROCESSOR_DEFINITIONS rather than OTHER_CPLUSPLUSFLAGS
 *    because Expo's post_install loop does not touch preprocessor defs.
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
        console.warn('[withNoHermes] Warning: :hermes_enabled not found in Podfile');
      } else {
        console.log('[withNoHermes] Patched Podfile: :hermes_enabled => false');
      }

      // Fix 2: inject fmt GCC_PREPROCESSOR_DEFINITIONS fix.
      //
      // Strategy: find the post_install block's closing `end` by locating
      // the line that is EXACTLY "end" (with optional surrounding whitespace)
      // after the post_install opening. We inject our code on the line just
      // before that closing `end`.
      //
      // We target only the `fmt` pod so there is zero risk of touching other
      // targets. GCC_PREPROCESSOR_DEFINITIONS is not modified by Expo's
      // react_native_post_install helper, making this safe even when injected
      // before it runs.
      const fmtInjection = [
        '',
        '  # Fix: fmt consteval errors with Xcode 16+ / Apple Clang 16+',
        '  # GCC_PREPROCESSOR_DEFINITIONS is used (not OTHER_CPLUSPLUSFLAGS)',
        '  # because Expo post_install does not reset preprocessor definitions.',
        '  installer.pods_project.targets.each do |target|',
        '    next unless target.name == \'fmt\'',
        '    target.build_configurations.each do |build_config|',
        '      defs = build_config.build_settings[\'GCC_PREPROCESSOR_DEFINITIONS\'] || \'$(inherited)\'',
        '      unless defs.include?(\'FMT_USE_NONTYPE_TEMPLATE_ARGS\')',
        '        build_config.build_settings[\'GCC_PREPROCESSOR_DEFINITIONS\'] = defs + \' FMT_USE_NONTYPE_TEMPLATE_ARGS=0\'',
        '      end',
        '    end',
        '  end',
      ].join('\n');

      // Find the post_install block and inject just before its closing `end`.
      // We look for the last bare `end` line after the post_install opening.
      const postInstallOpen = /post_install do \|[^|]+\|/;

      if (!postInstallOpen.test(noHermes)) {
        console.warn('[withNoHermes] Warning: post_install block not found; fmt fix NOT applied');
        fs.writeFileSync(podfilePath, noHermes);
        return config;
      }

      // Split into lines and find the post_install block boundaries
      const lines = noHermes.split('\n');
      const openIdx = lines.findIndex(l => postInstallOpen.test(l));

      // Walk forward from openIdx to find the matching closing `end`
      // by tracking Ruby block depth
      let depth = 0;
      let closeIdx = -1;
      for (let i = openIdx; i < lines.length; i++) {
        const stripped = lines[i].trim();
        // Count block-opening keywords
        if (/\b(do\b|if\b|unless\b|while\b|until\b|for\b|begin\b|def\b|class\b|module\b|case\b)/.test(stripped) && !/^\s*#/.test(lines[i])) {
          // Only count `do` blocks and structure openers that end with `end`
          if (/\bdo\b/.test(stripped)) depth++;
          else if (/^(if|unless|while|until|for|begin|def|class|module|case)\b/.test(stripped)) depth++;
        }
        if (stripped === 'end' || stripped.match(/^end\s*$/)) {
          depth--;
          if (depth <= 0) {
            closeIdx = i;
            break;
          }
        }
      }

      let patched;
      if (closeIdx !== -1) {
        // Insert our code just before the closing `end` line
        lines.splice(closeIdx, 0, fmtInjection);
        patched = lines.join('\n');
        console.log('[withNoHermes] Injected fmt GCC_PREPROCESSOR_DEFINITIONS fix before post_install closing end');
      } else {
        // Fallback: inject right after opening line
        console.warn('[withNoHermes] Warning: could not find closing end; injecting after opening line');
        patched = noHermes.replace(
          /(post_install do \|[^|]+\|\n)/,
          `$1${fmtInjection}\n`
        );
      }

      fs.writeFileSync(podfilePath, patched);
      return config;
    },
  ]);
};

module.exports = withNoHermes;
