import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
}

export function StarRating({ value, onChange, size = 24, readonly = false }: StarRatingProps) {
  const colors = useColors();

  const handlePress = (rating: number) => {
    if (readonly || !onChange) return;
    Haptics.selectionAsync();
    // Tap same star to clear rating
    onChange(value === rating ? 0 : rating);
  };

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable
          key={i}
          onPress={() => handlePress(i)}
          disabled={readonly}
          hitSlop={4}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Feather
            name="star"
            size={size}
            color={value && i <= value ? '#FFD34D' : colors.border}
            style={{ marginRight: 4 }}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
