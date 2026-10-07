import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { buddyColors } from '@/components/BuddyUI';

/** Year-only watched entry; no nested native modal. */
export function WatchedYearRating({ year, rating, onYearChange, onRatingChange, disabled = false, dark = false }: {
  year: number; rating: number; onYearChange: (year: number) => void;
  onRatingChange: (rating: number) => void; disabled?: boolean; dark?: boolean;
}) {
  const colors = useColors();
  const foreground = dark ? buddyColors.muted : colors.foreground;
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: foreground }]}>YEAR WATCHED</Text>
      <View style={styles.yearRow}>
        <TouchableOpacity disabled={disabled || year <= 1900} onPress={() => onYearChange(year - 1)} accessibilityLabel="Previous watched year" style={styles.arrow}>
          <Feather name="chevron-left" size={20} color={foreground} />
        </TouchableOpacity>
        <Text style={[styles.year, { color: foreground }]}>{year}</Text>
        <TouchableOpacity disabled={disabled || year >= new Date().getFullYear()} onPress={() => onYearChange(year + 1)} accessibilityLabel="Next watched year" style={styles.arrow}>
          <Feather name="chevron-right" size={20} color={foreground} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.label, { color: foreground }]}>YOUR RATING</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} disabled={disabled} onPress={() => onRatingChange(rating === star ? 0 : star)}
            accessibilityRole="button" accessibilityLabel={`${star} out of 5 stars`} accessibilityState={{ selected: star <= rating }} style={styles.arrow}>
            <FontAwesome name={star <= rating ? 'star' : 'star-o'} size={23} color={star <= rating ? '#FFD34D' : foreground} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 8, paddingVertical: 12 },
  label: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, letterSpacing: 0.8 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  year: { fontFamily: 'Manrope_700Bold', fontSize: 16 },
  arrow: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  stars: { flexDirection: 'row' },
});
