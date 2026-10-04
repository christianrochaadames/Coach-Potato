/**
 * Patches react-native's spm.rb to add nil-guards in SPMManager.
 *
 * Root cause: @clerk/expo registers ClerkKit + ClerkKitUI as SPM dependencies
 * but has no separate Pods build target. SPMManager.apply_on_post_install calls
 * project.targets.find twice (lines ~27 and ~33) and passes/stores the result
 * without nil-checking. When the target doesn't exist both calls return nil and
 * the subsequent method calls crash:
 *   Line ~80: target.package_product_dependencies  (inside add_spm_to_target)
 *   Line ~34: target.build_configurations           (Swift-package workaround)
 *
 * Fix: patch BOTH sites in spm.rb with early-return / next guards.
 */

const { withDangerousMod } = require('expo/config-plugins');

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const PATCH_MARKER = '# nil-target-fix-applied';

// ── Patch 1 ───────────────────────────────────────────────────────────────────
// Adds `return if target.nil?` at the top of add_spm_to_target so that
// target.package_product_dependencies is never called on nil.
const P1_OLD = '  def add_spm_to_target(project, target, url, requirement, products)';
const P1_NEW =
  '  def add_spm_to_target(project, target, url, requirement, products)\n' +
  '    return ' + PATCH_MARKER + ' if target.nil?';

// ── Patch 2 ───────────────────────────────────────────────────────────────────
// The "Swift package not found workaround" block re-finds the target and calls
// target.build_configurations.each without a nil check. Add `next if nil`.
//
// Original lines (indented with 8 spaces):
//   target = project.targets.find { |t| t.name == pod_name}
//   target.build_configurations.each do |config|
const P2_OLD =
  '        target = project.targets.find { |t| t.name == pod_name}\n' +
  '        target.build_configurations.each do |config|';
const P2_NEW =
  '        target = project.targets.find { |t| t.name == pod_name}\n' +
  '        next ' + PATCH_MARKER + ' if target.nil?\n' +
  '        target.build_configurations.each do |config|';

module.exports = function withSpmFix(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;

      // In the EAS pnpm monorepo the workspace root is two levels above the app
      // (workspace/artifacts/cinelog-mobile → workspace/).
      const searchRoots = [
        path.join(projectRoot, '..', '..'), // workspace root  ← primary
        path.join(projectRoot, '..'),
        projectRoot,
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
        console.warn('[with-spm-fix] No spm.rb files found — skipping');
        return modConfig;
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

        let changed = false;

        if (content.includes(P1_OLD)) {
          content = content.replace(P1_OLD, P1_NEW);
          changed = true;
          console.log(`[with-spm-fix] Applied patch 1 (add_spm_to_target nil guard)`);
        } else {
          console.warn(`[with-spm-fix] Patch 1 signature not found in ${spmPath}`);
        }

        if (content.includes(P2_OLD)) {
          content = content.replace(P2_OLD, P2_NEW);
          changed = true;
          console.log(`[with-spm-fix] Applied patch 2 (build_configurations nil guard)`);
        } else {
          console.warn(`[with-spm-fix] Patch 2 signature not found in ${spmPath}`);
        }

        if (changed) {
          fs.writeFileSync(spmPath, content);
          console.log(`[with-spm-fix] Wrote patched spm.rb: ${spmPath}`);
          patched++;
        }
      }

      if (patched === 0) {
        console.error('[with-spm-fix] No spm.rb files were patched!');
      }

      return modConfig;
    },
  ]);
};
