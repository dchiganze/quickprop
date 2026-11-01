const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const appReactQueryPath = path.resolve(
  __dirname,
  'node_modules/@tanstack/react-query',
);

// The API client is a workspace package, so its own node_modules can contain
// another peer-specific React Query installation. Keep its hooks on the same
// React Query singleton as the app's QueryClientProvider.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '@tanstack/react-query' ||
    moduleName.startsWith('@tanstack/react-query/')
  ) {
    const subpath = moduleName.slice('@tanstack/react-query'.length);
    const targetPath = subpath
      ? path.join(appReactQueryPath, subpath)
      : appReactQueryPath;

    return context.resolveRequest(context, targetPath, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;