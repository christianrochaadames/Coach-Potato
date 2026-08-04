/**
 * Patches react-native's spm.rb to add a nil-guard in add_spm_to_target.
 *
 * Root cause: @clerk/expo declares ClerkKit + ClerkKitUI as SPM dependencies
 * via spm_dependency() in ClerkExpo.podspec. SPMManager.apply_on_post_install
 * then looks for a Pods project target whose name matches the pod_name
 * ("ClerkExpo"). ClerkExpo has no separate Pods build target (it's an Expo
 * module compiled into ExpoModulesCore), so project.targets.find returns nil.
 * The next call target.package_product_dependencies crashes with:
 *   undefined method `package_product_dependencies' for nil:NilClass
 *
 * Fix: find all spm.rb files in node_modules and add `return if target.nil?`
 * at the top of add_spm_to_target. This is safe — a nil target means no
 * Pods project target to attach the SPM dependency to, so skipping is correct.
 */

let withDangerousMod;
try {
  ({ withDangerousMod } = require('@expo/config-plugins'));
} catch {
  ({ withDangerousMod } = require('expo/config-plugins'));
}

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const PATCH_MARKER = '# nil-target-fix-applied';
const OLD_LINE =
  '  def add_spm_to_target(project, target, url, requirement, products)';
const NEW_LINE =
  '  def add_spm_to_target(project, target, url, requirement, products)\n' +
  '    return ' + PATCH_MARKER + ' if target.nil?';

module.exports = function withSpmFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // In the EAS pnpm monorepo the workspace root is two levels above the app
      // (workspace/artifacts/cinelog-mobile → workspace/).
      // We also check one level up and the project root itself as fallbacks.
      const searchRoots = [
        path.join(projectRoot, '..', '..'), // workspace root  ← primary
        path.join(projectRoot, '..'),        // one level up
        projectRoot,                          // app-level node_modules
      ];

      let spmFiles = [];
      for (const root of searchRoots) {
        const nmDir = path.join(root, 'node_modules');
        if (!fs.existsSync(nmDir)) continue;
        try {
          const out = execSync(
            `find "${nmDir}" -name "spm.rb" -path "*/cocoapods/spm.rb" 2>/dev/null`,
            { encoding: 'utf-8', timeout: 15000 }
          ).trim();
          if (out) spmFiles.push(...out.split('\n').filter(Boolean));
        } catch (_) { /* ignore */ }
      }

      spmFiles = [...new Set(spmFiles)];

      if (spmFiles.length === 0) {
        console.warn('[with-spm-fix] No spm.rb files found — skipping patch');
        return config;
      }

      let patched = 0;
      for (const spmPath of spmFiles) {
        if (!fs.existsSync(spmPath)) continue;
        let content = fs.readFileSync(spmPath, 'utf-8');

        if (content.includes(PATCH_MARKER)) {
          console.log(`[with-spm-fix] Already patched: ${spmPath}`);
          patched++;
          continue;
        }

        if (!content.includes(OLD_LINE)) {
          console.warn(`[with-spm-fix] Signature not found in ${spmPath} — skipping`);
          continue;
        }

        content = content.replace(OLD_LINE, NEW_LINE);
        fs.writeFileSync(spmPath, content);
        console.log(`[with-spm-fix] Patched spm.rb at: ${spmPath}`);
        patched++;
      }

      if (patched === 0) {
        console.error('[with-spm-fix] No spm.rb files were patched!');
      }

      return config;
    },
  ]);
};
