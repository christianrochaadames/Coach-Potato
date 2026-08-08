/**
 * app.config.js — Expo dynamic config
 *
 * Injects EXPO_PUBLIC_* env vars at build time so Metro can inline them
 * into the JS bundle. EAS builds have access to project secrets; we copy
 * them here so the app can always find Clerk + the API domain even if the
 * EXPO_PUBLIC_ prefix wasn't explicitly set in the EAS env-var dashboard.
 */
module.exports = ({ config }) => {
  // ── Clerk publishable key ────────────────────────────────────────────────
  // Try EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY first (set explicitly in EAS env),
  // fall back to plain CLERK_PUBLISHABLE_KEY (Replit secret / EAS secret).
  if (
    !process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_PUBLISHABLE_KEY
  ) {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY =
      process.env.CLERK_PUBLISHABLE_KEY;
  }

  // ── API domain ───────────────────────────────────────────────────────────
  // Default to the deployed Replit URL so production builds always work.
  if (!process.env.EXPO_PUBLIC_DOMAIN) {
    process.env.EXPO_PUBLIC_DOMAIN = 'couch-potato.replit.app';
  }

  return {
    ...config,
  };
};
