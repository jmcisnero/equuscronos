const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (including shared libraries in libs/)
config.watchFolders = [workspaceRoot];

// 2. Tell Metro to resolve packages looking at the project node_modules and the workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Enable hierarchical lookup (recommended in modern Metro to resolve transitive/nested dependencies)
config.resolver.disableHierarchicalLookup = false;

// 4. Force all resolutions of 'react' and 'react-native' to use the mobile app's local node_modules (React 18)
// to prevent duplicate package versions (React 18 vs React 19) in the monorepo bundling process.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const redirectedName = moduleName.replace('react', path.resolve(projectRoot, 'node_modules/react'));
    return context.resolveRequest(context, redirectedName, platform);
  }
  if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    const redirectedName = moduleName.replace('react-native', path.resolve(projectRoot, 'node_modules/react-native'));
    return context.resolveRequest(context, redirectedName, platform);
  }
  if (moduleName === '@react-native/virtualized-lists' || moduleName.startsWith('@react-native/virtualized-lists/')) {
    const redirectedName = moduleName.replace(
      '@react-native/virtualized-lists',
      path.resolve(projectRoot, 'node_modules/react-native/node_modules/@react-native/virtualized-lists')
    );
    return context.resolveRequest(context, redirectedName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
