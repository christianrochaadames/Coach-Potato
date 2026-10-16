import { forwardRef } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

type ControlledPlaceholderInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  placeholderStyle?: StyleProp<TextStyle>;
};

export const ControlledPlaceholderInput = forwardRef<TextInput, ControlledPlaceholderInputProps>(
  function ControlledPlaceholderInput(
    {
      containerStyle,
      placeholder,
      placeholderStyle,
      placeholderTextColor = '#A09898',
      style,
      value,
      ...inputProps
    },
    ref,
  ) {
    const showPlaceholder = Boolean(placeholder) && !value;

    return (
      <View style={[styles.container, containerStyle]}>
        <TextInput
          {...inputProps}
          ref={ref}
          value={value}
          style={style}
        />
        {showPlaceholder ? (
          <View pointerEvents="none" style={styles.placeholderOverlay}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.placeholder,
                { color: placeholderTextColor },
                placeholderStyle,
              ]}
            >
              {placeholder}
            </Text>
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { position: 'relative' },
  placeholderOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  placeholder: {
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    letterSpacing: 0,
  },
});