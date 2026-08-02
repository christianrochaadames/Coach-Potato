import { Colors, ColorScheme } from '@/constants/colors';

export function useColors(): ColorScheme {
  // CineLog is light-mode only for now
  return Colors.light;
}
