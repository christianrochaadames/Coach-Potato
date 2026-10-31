const { withXcodeProject, IOSConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withInviteShare(config) {
  return withXcodeProject(config, mod => {
    const name = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
    const nativeDir = path.join(mod.modRequest.platformProjectRoot, name);
    fs.mkdirSync(nativeDir, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'SpudInviteShare.mm'), path.join(nativeDir, 'SpudInviteShare.mm'));
    fs.copyFileSync(path.join(mod.modRequest.projectRoot, 'assets/images/icon.png'), path.join(nativeDir, 'spud-share-icon.png'));
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${name}/SpudInviteShare.mm`, groupName: name, project: mod.modResults,
    });
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: `${name}/spud-share-icon.png`, groupName: name, project: mod.modResults, isBuildFile: true,
    });
    // The current Xcode helper does not infer these file types. Without an
    // explicit Objective-C++ type Xcode may skip compiling the native module.
    for (const file of Object.values(mod.modResults.pbxFileReferenceSection())) {
      if (file && typeof file === 'object') {
        const filePath = String(file.path).replaceAll('"', '');
        if (filePath === `${name}/SpudInviteShare.mm`) file.lastKnownFileType = 'sourcecode.cpp.objcpp';
        if (filePath === `${name}/spud-share-icon.png`) file.lastKnownFileType = 'image.png';
      }
    }
    mod.modResults.addFramework('LinkPresentation.framework', { target: mod.modResults.getFirstTarget().uuid });
    return mod;
  });
};
