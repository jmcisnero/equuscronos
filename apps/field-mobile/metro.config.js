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

// 3. Disable hierarchical lookup to ensure symlinked workspace packages are resolved correctly
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
