const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Two fixes applied to the generated iOS Podfile:
 *
 * 1. Hermes disabled — replaces :hermes_enabled => <any> with false so the
 *    app runs on JavaScriptCore instead of Hermes (which crashes on iOS 26).
 *
 * 2. fmt consteval fix — patches Pods/fmt/src/format.cc (the exact file
 *    the compiler errors on) by prepending #define FMT_USE_NONTYPE_TEMPLATE_ARGS 0
 *    inside the existing post_install block.
 *
 *    Injection strategy: find the LAST bare "end" line in the Podfile
 *    (which is the post_install block closer) and insert the Ruby patch
 *    code just before it. This avoids fragile depth-tracking.
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

      // Fix 2: inject fmt source patch into post_install.
      //
      // We patch Pods/fmt/src/format.cc directly — this is the exact
      // translation unit the compiler reports the error on. Prepending
      // the #define before any #include guarantees it takes effect.
      //
      // Injection: find the last bare "end" line in the file
      // (the post_install block closer) and insert our code before it.
      const fmtRuby = `
  # ---- withNoHermes: fmt consteval fix for Xcode 26 / Apple Clang 16+ ----
  # Patch format.cc directly so the #define is the first thing the compiler sees.
  begin
    fmt_src = File.join(installer.sandbox.root.to_s, 'fmt', 'src', 'format.cc')
    if File.exist?(fmt_src)
      src_content = File.read(fmt_src)
      unless src_content.include?('FMT_USE_NONTYPE_TEMPLATE_ARGS 0')
        File.write(fmt_src, "#define FMT_USE_NONTYPE_TEMPLATE_ARGS 0\\n" + src_content)
        puts "[withNoHermes] Patched fmt/src/format.cc — consteval fix applied"
      else
        puts "[withNoHermes] fmt/src/format.cc already patched"
      end
    else
      puts "[withNoHermes] WARNING: fmt/src/format.cc not found at #{fmt_src}"
    end
    # Also patch all fmt headers as belt-and-suspenders
    Dir.glob(File.join(installer.sandbox.root.to_s, 'fmt', 'include', 'fmt', '*.h')).each do |h|
      hc = File.read(h)
      if hc.include?('FMT_USE_NONTYPE_TEMPLATE_ARGS') && !hc.include?('FMT_USE_NONTYPE_TEMPLATE_ARGS 0')
        File.write(h, "#define FMT_USE_NONTYPE_TEMPLATE_ARGS 0\\n" + hc)
        puts "[withNoHermes] Patched header: #{h}"
      end
    end
  rescue => e
    puts "[withNoHermes] ERROR during fmt patch: #{e.message}"
  end
  # ---- end withNoHermes fmt fix ----
`;

      const lines = noHermes.split('\n');

      // Find the last line that is exactly "end" (the post_install closer)
      let lastEndIdx = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/^end\s*$/.test(lines[i])) {
          lastEndIdx = i;
          break;
        }
      }

      let patched;
      if (lastEndIdx !== -1) {
        lines.splice(lastEndIdx, 0, fmtRuby);
        patched = lines.join('\n');
        console.log('[withNoHermes] Injected fmt fix before last `end` in Podfile');
      } else {
        console.warn('[withNoHermes] WARNING: could not find closing end — appending post_install block');
        patched = noHermes + `\npost_install do |installer|\n${fmtRuby}\nend\n`;
      }

      fs.writeFileSync(podfilePath, patched);
      return config;
    },
  ]);
};

module.exports = withNoHermes;
