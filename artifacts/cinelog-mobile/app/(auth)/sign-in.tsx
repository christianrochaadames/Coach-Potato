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
import { useSignIn, useSSO } from '@clerk/expo';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<'google' | 'facebook' | null>(null);
  const [verifyCode, setVerifyCode] = useState('');

  // Warm up browser on Android for faster OAuth
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  const handleEmailSignIn = async () => {
    if (!email || !password) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signIn.password({ emailAddress: email, password });
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

  const handleVerifyMfa = async () => {
    await signIn.mfa.verifyEmailCode({ code: verifyCode });
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/');
          if (!url.startsWith('http')) router.replace(url as any);
        },
      });
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    setSsoLoading('google');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
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

  const handleFacebookSignIn = useCallback(async () => {
    setSsoLoading('facebook');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_facebook',
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

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const isFetching = fetchStatus === 'fetching';

  // MFA verification step
  if (signIn.status === 'needs_client_trust') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 20 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Verify your identity</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Enter the code sent to your email
        </Text>
        <TextInput
          value={verifyCode}
          onChangeText={setVerifyCode}
          placeholder="000000"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          textAlign="center"
        />
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={handleVerifyMfa}
          disabled={isFetching || !verifyCode}
          activeOpacity={0.8}
        >
          {isFetching ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => signIn.mfa.sendEmailCode()} activeOpacity={0.7}>
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
        contentContainerStyle={[styles.container, { paddingTop: topPad + 20, paddingBottom: bottomPad + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <Feather name="film" size={28} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Sign in to your Spud account
          </Text>
        </View>

        {/* Google SSO */}
        <TouchableOpacity
          style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleGoogleSignIn}
          disabled={!!ssoLoading}
          activeOpacity={0.8}
        >
          {ssoLoading === 'google' ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={[styles.googleBtnText, { color: colors.foreground }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Facebook SSO */}
        <TouchableOpacity
          style={[styles.googleBtn, { backgroundColor: '#1877F2', borderColor: '#1877F2' }]}
          onPress={handleFacebookSignIn}
          disabled={!!ssoLoading}
          activeOpacity={0.8}
        >
          {ssoLoading === 'facebook' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.fbIcon}>f</Text>
              <Text style={[styles.googleBtnText, { color: '#fff' }]}>
                Continue with Facebook
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Email */}
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
        {errors.fields.identifier && (
          <Text style={[styles.error, { color: colors.destructive }]}>{errors.fields.identifier.message}</Text>
        )}

        {/* Password */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
        <View style={[styles.passwordRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
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

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: (!email || !password || isFetching) ? colors.muted : colors.primary },
          ]}
          onPress={handleEmailSignIn}
          disabled={!email || !password || isFetching}
          activeOpacity={0.8}
        >
          {isFetching ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: (!email || !password) ? colors.mutedForeground : colors.primaryForeground }]}>
              Sign in
            </Text>
          )}
        </TouchableOpacity>

        {/* Link to sign up */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Don't have an account?{' '}
          </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={[styles.linkText, { color: colors.primary }]}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, gap: 12 },
  brand: { alignItems: 'center', gap: 8, marginBottom: 8 },
  logoBox: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: 'Manrope_400Regular', textAlign: 'center' },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, gap: 10,
  },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  fbIcon: { fontSize: 18, fontWeight: '700', color: '#fff' },
  googleBtnText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
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
