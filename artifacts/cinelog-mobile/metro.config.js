const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// In a pnpm monorepo Expo detects the workspace root and uses it as Metro's
// project root, breaking native bundle resolution. We must pin it explicitly.
const projectRoot = __dirname;                              // artifacts/cinelog-mobile
const workspaceRoot = path.resolve(projectRoot, '../..'); // repo root

const config = getDefaultConfig(projectRoot);

// Tell Metro to use this package's directory as the project root, not the
// pnpm workspace root that Expo's monorepo detection would otherwise pick.
config.projectRoot = projectRoot;

// Still watch the whole workspace so cross-package imports resolve.
config.watchFolders = [workspaceRoot];

// Resolve node_modules from the app first, then fall back to the workspace.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
