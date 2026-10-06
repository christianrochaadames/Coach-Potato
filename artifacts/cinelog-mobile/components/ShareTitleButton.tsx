import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTitleShare, type ShareableTitle } from '@/utils/titleShare';

/** Round share button used on every title surface. Shares message + canonical public URL only. */
export function ShareTitleButton({ title, background = '#EFE4D2', color = '#5B3FA5', size = 36 }: {
  title: ShareableTitle | null; background?: string; color?: string; size?: number;
}) {
  const { share, busy } = useTitleShare(title);
  return (
    <TouchableOpacity
      onPress={share} disabled={!title || busy} activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}
      accessibilityRole="button" accessibilityLabel={title ? `Share ${title.title}` : 'Share'} testID="share-title"
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : <Feather name="share" size={Math.round(size * 0.47)} color={color} />}
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({ btn: { alignItems: 'center', justifyContent: 'center' } });
