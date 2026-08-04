// CouchPotato brand palette — synced from artifacts/cinelog/src/index.css

export const Colors = {
  light: {
    background: '#FFF3E8',
    foreground: '#111111',
    primary: '#116149',
    primaryForeground: '#ffffff',
    secondary: '#9BD6FF',
    secondaryForeground: '#111111',
    muted: '#EFE4D2',
    mutedForeground: '#7E7A73',
    accent: '#FF4BAE',
    accentForeground: '#ffffff',
    destructive: '#e53e3e',
    card: '#ffffff',
    cardForeground: '#111111',
    border: '#E2D9CE',
    input: '#D5C9BC',
    ring: '#116149',
    // Brand extras
    cream: '#FFF3E8',
    green: '#116149',
    blue: '#9BD6FF',
    // Radius
    radius: 12,
    radiusSm: 8,
    radiusLg: 16,
    radiusXl: 24,
  },
} as const;

export type ColorScheme = typeof Colors.light;
