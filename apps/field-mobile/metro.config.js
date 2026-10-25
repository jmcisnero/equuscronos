const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (including shared libraries in libs/)
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), workspaceRoot]));

// Exclude heavy web build directories, .git, and brain logs from the Metro watcher.
// Patterns accept both "/" (Linux/EAS) and "\" (Windows). NEVER block a generic
// "dist/" folder: node_modules packages (memoize-one, ...) and @equuscronos/shared
// publish their entry points there.
const SEP = '[\\\\/]';
config.resolver.blockList = [
  new RegExp(`${SEP}apps${SEP}(admin-web|public-web|web-informativa)${SEP}\\.next${SEP}.*`),
  new RegExp(`${SEP}apps${SEP}api${SEP}dist${SEP}.*`),
  new RegExp(`${SEP}\\.git${SEP}.*`),
  new RegExp(`${SEP}\\.system_generated${SEP}.*`),
  new RegExp(`${SEP}brain${SEP}.*`),
];

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

// 5. Use a per-app Metro cache so field-mobile and user-mobile don't clear the
// same shared %TEMP%\metro-cache concurrently (causes EPERM on Windows).
const { FileStore } = require('metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(projectRoot, 'node_modules', '.cache', 'metro') }),
];

module.exports = config;
