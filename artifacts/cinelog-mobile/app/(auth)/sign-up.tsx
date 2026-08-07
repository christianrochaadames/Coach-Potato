import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useSignUp, useSSO } from '@clerk/expo';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [ssoLoading, setSsoLoading] = useState<'google' | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const isFetching = fetchStatus === 'fetching';

  // Warm up browser on Android for faster OAuth
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  const handleSSOSignUp = useCallback(async (provider: 'oauth_google') => {
    setSsoLoading('google');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: provider,
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await setActive!({
          session: createdSessionId,
          navigate: async ({ decorateUrl }) => {
            const url = decorateUrl('/');
            if (!url.startsWith('http')) router.replace(url as any);
          },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSsoLoading(null);
    }
  }, [startSSOFlow, router]);

  const handleSignUp = async () => {
    if (!email || !password) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/');
          if (!url.startsWith('http')) router.replace(url as any);
        },
      });
    }
  };

  // Email verification step
  const needsVerification =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  if (needsVerification) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 40, paddingHorizontal: 24 }]}>
        <View style={styles.brand}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <Feather name="mail" size={28} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We sent a 6-digit code to {email}
          </Text>
        </View>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
          maxLength={6}
        />
        {errors.fields.code && (
          <Text style={[styles.error, { color: colors.destructive }]}>{errors.fields.code.message}</Text>
        )}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: code.length === 6 ? colors.primary : colors.muted }]}
          onPress={handleVerify}
          disabled={isFetching || code.length !== 6}
          activeOpacity={0.8}
        >
          {isFetching ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={[styles.primaryBtnText, { color: code.length === 6 ? colors.primaryForeground : colors.mutedForeground }]}>
              Verify email
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => signUp.verifications.sendEmailCode()} activeOpacity={0.7} style={{ alignItems: 'center' }}>
          <Text style={[styles.linkText, { color: colors.primary }]}>Resend code</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topPad + 20, paddingBottom: bottomPad + 20, paddingHorizontal: 24, gap: 12 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <Feather name="film" size={28} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Create your account</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Start tracking what you watch
          </Text>
        </View>

        {/* Google SSO */}
        <TouchableOpacity
          style={[styles.ssoBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => handleSSOSignUp('oauth_google')}
          disabled={!!ssoLoading}
          activeOpacity={0.8}
        >
          {ssoLoading === 'google' ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={[styles.ssoBtnText, { color: colors.foreground }]}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        />
        {errors.fields.emailAddress && (
          <Text style={[styles.error, { color: colors.destructive }]}>{errors.fields.emailAddress.message}</Text>
        )}

        <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
        <View style={[styles.passwordRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPassword}
            style={[styles.passwordInput, { color: colors.foreground }]}
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} activeOpacity={0.7}>
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        {errors.fields.password && (
          <Text style={[styles.error, { color: colors.destructive }]}>{errors.fields.password.message}</Text>
        )}

        {/* Clerk bot protection */}
        <View nativeID="clerk-captcha" />

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: (!email || !password || isFetching) ? colors.muted : colors.primary },
          ]}
          onPress={handleSignUp}
          disabled={!email || !password || isFetching}
          activeOpacity={0.8}
        >
          {isFetching ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: (!email || !password) ? colors.mutedForeground : colors.primaryForeground }]}>
              Create account
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Already have an account?{' '}
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={[styles.linkText, { color: colors.primary }]}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  brand: { alignItems: 'center', gap: 8, marginBottom: 8 },
  logoBox: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: 'Manrope_400Regular', textAlign: 'center' },
  ssoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, gap: 10,
  },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  ssoBtnText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: 'Manrope_400Regular' },
  label: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.4, marginBottom: -4 },
  input: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: 'Manrope_400Regular',
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 13, gap: 8,
  },
  passwordInput: { flex: 1, fontSize: 15, fontFamily: 'Manrope_400Regular', padding: 0 },
  error: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: -6 },
  primaryBtn: {
    paddingVertical: 15, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  primaryBtnText: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  footerText: { fontSize: 14, fontFamily: 'Manrope_400Regular' },
  linkText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
});
