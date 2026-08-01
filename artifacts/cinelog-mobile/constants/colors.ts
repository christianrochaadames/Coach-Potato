/**
 * CineLog brand colors — derived from the sibling web app (cinelog/src/index.css).
 * Warm cream background, forest-green primary, couch-blue secondary.
 */
const colors = {
  light: {
    // Legacy aliases
    text: '#111111',
    tint: '#116149',

    // Core surfaces
    background: '#FFF3E8',
    foreground: '#111111',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#111111',

    // Primary action color — CouchPotato green
    primary: '#116149',
    primaryForeground: '#ffffff',

    // Secondary — couch blue
    secondary: '#9BD6FF',
    secondaryForeground: '#111111',

    // Muted
    muted: '#EFE4D2',
    mutedForeground: '#7E7A73',

    // Accent — hot pink
    accent: '#FF4BAE',
    accentForeground: '#ffffff',

    // Destructive
    destructive: '#e53e3e',
    destructiveForeground: '#ffffff',

    // Borders and inputs
    border: '#E2D9CE',
    input: '#D5C9BC',
  },

  // Border radius in px — matches web --radius-md (12px)
  radius: 12,
};

export default colors;
