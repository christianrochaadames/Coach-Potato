import { Colors, ColorScheme } from '@/constants/colors';

export function useColors(): ColorScheme {
  // CouchPotato is light-mode only for now
  return Colors.light;
}
