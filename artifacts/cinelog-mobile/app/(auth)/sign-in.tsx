import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const isFetching = fetchStatus === 'fetching';

  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  const handleSignIn = async () => {
    if (!email || !password) return;
    const { error } = await signIn.password({ identifier: email, password });
    if (error) return;
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/');
          if (!url.startsWith('http')) router.replace(url as any);
        },
      });
    }
  };

  const errorMsg =
    errors?.fields?.identifier?.message ??
    errors?.fields?.password?.message ??
    null;

  return (
    <View style={{ flex: 1, backgroundColor: '#C5B8FF' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding row */}
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/images/spud-logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Image
              source={require('@/assets/images/spud-thumbsup.png')}
              style={styles.mascotImg}
              resizeMode="contain"
            />
          </View>

          {/* White card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to Spud</Text>
            <Text style={styles.cardSub}>Your couch sidekick is waiting.</Text>

            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#A09898"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#A09898"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
              />
            </View>

            {/* Error */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Clerk captcha anchor */}
            <View nativeID="clerk-captcha" />

            {/* Primary button */}
            <TouchableOpacity
              style={[styles.btnPrimary, (isFetching || !email || !password) && { opacity: 0.6 }]}
              onPress={handleSignIn}
              disabled={isFetching || !email || !password}
              activeOpacity={0.85}
            >
              {isFetching ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Sign in</Text>
              )}
            </TouchableOpacity>

            {/* Switch to sign-up */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/sign-up')}
              style={styles.switchRow}
              activeOpacity={0.7}
            >
              <Text style={styles.switchText}>
                Don't have an account?{' '}
                <Text style={styles.switchLink}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20 },
  brandRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
    maxWidth: 440, marginBottom: 20,
  },
  logoImg: { height: 90, width: 160 },
  mascotImg: { height: 90, width: 75 },

  card: {
    width: '100%', maxWidth: 440,
    backgroundColor: '#ffffff', borderRadius: 24, padding: 24,
  },
  cardTitle: {
    fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#111111', marginBottom: 4,
  },
  cardSub: {
    fontSize: 14, fontFamily: 'Manrope_400Regular', color: '#7E7A73', marginBottom: 20,
  },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: '#111111', marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFF3E8', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2D9CE',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#111111',
  },

  errorBox: {
    backgroundColor: '#FEE2E2', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  errorText: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#DC2626' },

  btnPrimary: {
    backgroundColor: '#5B50D0', borderRadius: 24,
    paddingVertical: 14, alignItems: 'center', marginBottom: 16, marginTop: 4,
  },
  btnPrimaryText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  switchRow: { alignItems: 'center', marginTop: 8 },
  switchText: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },
  switchLink: { fontFamily: 'Manrope_700Bold', color: '#5B50D0' },
});
