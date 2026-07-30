const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Two fixes applied to the generated iOS Podfile:
 *
 * 1. Hermes disabled — replaces :hermes_enabled => <any> with false so the
 *    app runs on JavaScriptCore instead of Hermes (which crashes on iOS 26).
 *
 * 2. fmt consteval fix — directly patches the fmt header source file
 *    (Pods/fmt/include/fmt/core.h or base.h) by prepending
 *    #define FMT_USE_NONTYPE_TEMPLATE_ARGS 0
 *    This is done in post_install AFTER pods are fetched, making it
 *    immune to any Xcode build-settings override.
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

      // Fix 2: inject a source-level patch for the fmt consteval issue.
      //
      // Build-settings approaches (OTHER_CPLUSPLUSFLAGS, GCC_PREPROCESSOR_DEFINITIONS)
      // are unreliable on Xcode 26.5 because Expo's react_native_post_install
      // loop may reset them. Instead we directly prepend the #define to the
      // fmt header file after pods are fetched, before any compilation occurs.
      //
      // The fmt header checks:  #ifndef FMT_USE_NONTYPE_TEMPLATE_ARGS
      // so prepending our define causes the auto-detection block to be skipped.
      const fmtInjection = [
        '',
        '  # Fix: fmt consteval errors with Xcode 26 / Apple Clang 16+',
        '  # Patch the fmt header source directly — more reliable than build settings.',
        '  fmt_headers = Dir.glob("#{installer.sandbox.root}/fmt/include/fmt/{core,base}.h")',
        '  fmt_headers.each do |header|',
        '    content = File.read(header)',
        '    unless content.include?(\'FMT_USE_NONTYPE_TEMPLATE_ARGS 0\')',
        '      File.write(header, "// Patched by withNoHermes: disable consteval fmt strings\\n#define FMT_USE_NONTYPE_TEMPLATE_ARGS 0\\n" + content)',
        '      puts "[withNoHermes] Patched fmt header: #{header}"',
        '    end',
        '  end',
        '  if fmt_headers.empty?',
        '    puts "[withNoHermes] WARNING: fmt header not found — consteval fix NOT applied"',
        '  end',
      ].join('\n');

      // Find the post_install block and inject just before its closing `end`
      const postInstallOpen = /post_install do \|[^|]+\|/;

      if (!postInstallOpen.test(noHermes)) {
        console.warn('[withNoHermes] Warning: post_install block not found; fmt fix NOT applied');
        fs.writeFileSync(podfilePath, noHermes);
        return config;
      }

      const lines = noHermes.split('\n');
      const openIdx = lines.findIndex(l => postInstallOpen.test(l));

      // Walk forward tracking Ruby block depth to find the matching `end`
      let depth = 0;
      let closeIdx = -1;
      for (let i = openIdx; i < lines.length; i++) {
        const stripped = lines[i].trim();
        if (!/^\s*#/.test(lines[i])) {
          if (/\bdo\b/.test(stripped)) depth++;
          else if (/^(if|unless|while|until|for|begin|def|class|module|case)\b/.test(stripped)) depth++;
        }
        if (/^end\s*$/.test(stripped)) {
          depth--;
          if (depth <= 0) {
            closeIdx = i;
            break;
          }
        }
      }

      let patched;
      if (closeIdx !== -1) {
        lines.splice(closeIdx, 0, fmtInjection);
        patched = lines.join('\n');
        console.log('[withNoHermes] Injected fmt source-level fix before post_install closing end');
      } else {
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
