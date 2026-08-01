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

      // Fix 2: replace consteval → constexpr in all fmt files via post_install
      const fmtRuby = `
  # ---- withNoHermes: fmt Apple Clang 16 / Xcode 26 fix ----
  begin
    fmt_root = File.join(installer.sandbox.root.to_s, 'fmt')
    patched  = 0
    Dir.glob(File.join(fmt_root, '**', '*.{h,cc}')).each do |f|
      src = File.read(f)
      if src.include?('consteval')
        File.write(f, src.gsub('consteval', 'constexpr'))
        patched += 1
        puts "[withNoHermes] consteval→constexpr: \#{File.basename(f)}"
      end
    end
    puts "[withNoHermes] fmt fix done — \#{patched} file(s) patched"
  rescue => e
    puts "[withNoHermes] ERROR: \#{e.message}"
  end
  # ---- end withNoHermes fmt fix ----
`;

      const lines = noHermes.split('\n');

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
        patched = noHermes + `\npost_install do |installer|\n${fmtRuby}\nend\n`;
      }

      fs.writeFileSync(podfilePath, patched);
      return config;
    },
  ]);
};

module.exports = withNoHermes;