const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Patches the generated Podfile to guard against nil targets in SPMManager.
 *
 * Root cause: @clerk/expo declares ClerkKit + ClerkKitUI as SPM dependencies
 * via `spm_dependency(products: ['ClerkKit','ClerkKitUI'])` in its podspec.
 * React Native's SPMManager.apply_on_post_install then searches for the pod's
 * build target by name ("ClerkExpo") in the Pods project. ClerkExpo has no
 * build target (pure Expo module — no compiled code in the Pods project), so
 * `project.targets.find` returns nil and the next line crashes with:
 *   undefined method `package_product_dependencies' for nil:NilClass
 *
 * Fix: reopen SPMManager before post_install and filter out any pod_names that
 * have no corresponding Pods project target before calling the original method.
 */
const PATCH = `
# ---- SPM nil-target fix (react-native 0.81.x + @clerk/expo) ----
class SPMManager
  alias_method :_orig_apply_on_post_install, :apply_on_post_install
  def apply_on_post_install(installer)
    project = installer.pods_project
    @dependencies_by_pod.select! do |pod_name, _|
      found = project.targets.any? { |t| t.name == pod_name }
      Pod::UI.puts "[SPM-fix] Skipping SPM deps for nil target: #{pod_name}" unless found
      found
    end
    _orig_apply_on_post_install(installer)
  end
end
# ---- end SPM nil-target fix ----

`;

module.exports = function withSpmFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn('[with-spm-fix] Podfile not found, skipping patch');
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, 'utf-8');

      if (podfile.includes('SPM nil-target fix')) {
        // Already patched (e.g. re-running prebuild)
        return config;
      }

      // Insert the monkey-patch immediately before the first post_install block
      podfile = podfile.replace(
        /^post_install do \|installer\|/m,
        PATCH + 'post_install do |installer|'
      );

      fs.writeFileSync(podfilePath, podfile);
      console.log('[with-spm-fix] Patched Podfile to guard nil SPM targets');
      return config;
    },
  ]);
};
