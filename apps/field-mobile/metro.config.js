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

const reactPath = path.dirname(require.resolve('react/package.json'));
const reactNativePath = path.dirname(require.resolve('react-native/package.json'));
let virtualizedListsPath;
try {
  virtualizedListsPath = path.dirname(require.resolve('@react-native/virtualized-lists/package.json'));
} catch (e) {
  virtualizedListsPath = path.resolve(reactNativePath, 'node_modules/@react-native/virtualized-lists');
}

// 4. Force all resolutions of 'react', 'react-native' and '@react-native/virtualized-lists'
// to use the exact resolved package paths in the monorepo bundling process.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const redirectedName = moduleName === 'react'
      ? reactPath
      : moduleName.replace('react/', reactPath + '/');
    return context.resolveRequest(context, redirectedName, platform);
  }
  if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    const redirectedName = moduleName === 'react-native'
      ? reactNativePath
      : moduleName.replace('react-native/', reactNativePath + '/');
    return context.resolveRequest(context, redirectedName, platform);
  }
  if (moduleName === '@react-native/virtualized-lists' || moduleName.startsWith('@react-native/virtualized-lists/')) {
    const redirectedName = moduleName === '@react-native/virtualized-lists'
      ? virtualizedListsPath
      : moduleName.replace('@react-native/virtualized-lists/', virtualizedListsPath + '/');
    return context.resolveRequest(context, redirectedName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
