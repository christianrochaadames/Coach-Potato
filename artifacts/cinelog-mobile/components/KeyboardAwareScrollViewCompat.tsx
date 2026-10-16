import { Platform, ScrollView, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

type KeyboardAwareScrollViewCompatProps = ScrollViewProps & {
  bottomOffset?: number;
  disableScrollOnKeyboardHide?: boolean;
};

/**
 * Keeps form fields above the native keyboard while retaining ScrollView's
 * web-compatible behavior.
 */
export function KeyboardAwareScrollViewCompat({
  bottomOffset = 0,
  disableScrollOnKeyboardHide,
  ...props
}: KeyboardAwareScrollViewCompatProps) {
  if (Platform.OS === 'web') {
    return <ScrollView {...props} />;
  }

  return (
    <KeyboardAwareScrollView
      bottomOffset={bottomOffset}
      disableScrollOnKeyboardHide={disableScrollOnKeyboardHide}
      {...props}
    />
  );
}