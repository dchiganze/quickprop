const { withXcodeProject } = require('@expo/config-plugins');

const TARGET = '16.4';

module.exports = function withDeploymentTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const buildConfigs = project.pbxXCBuildConfigurationSection();

    let count = 0;
    Object.keys(buildConfigs).forEach((key) => {
      const bc = buildConfigs[key];
      if (bc && typeof bc === 'object' && bc.buildSettings) {
        const current = bc.buildSettings['IPHONEOS_DEPLOYMENT_TARGET'];
        if (current !== undefined) {
          bc.buildSettings['IPHONEOS_DEPLOYMENT_TARGET'] = TARGET;
          count++;
        }
      }
    });

    console.log(
      `[withDeploymentTarget] Set IPHONEOS_DEPLOYMENT_TARGET = ${TARGET} ` +
      `on ${count} build configuration(s).`
    );
    return config;
  });
};