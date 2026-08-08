import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import { useSignUp, useSSO } from '@clerk/expo';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app'}`;

async function checkUsernameAvailability(username: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/check-username?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    return data.available === true;
  } catch {
    return true; // optimistic — server validates on save too
  }
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [ssoLoading, setSsoLoading] = useState<'google' | null>(null);

  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const isFetching = fetchStatus === 'fetching';

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  const handleUsernameChange = (val: string) => {
    const cleaned = val.replace(/[^a-zA-Z0-9_]/g, '');
    setUsername(cleaned);
    setUsernameStatus('idle');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (cleaned.length >= 2) {
      setUsernameStatus('checking');
      usernameTimer.current = setTimeout(async () => {
        const available = await checkUsernameAvailability(cleaned);
        setUsernameStatus(available ? 'available' : 'taken');
      }, 500);
    }
  };

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
    if (usernameStatus === 'taken') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    // Stash profile data before finalize — AuthTokenSync will save it once the session is active
    const profileData: Record<string, string> = {};
    if (firstName.trim()) profileData.firstName = firstName.trim();
    if (lastName.trim()) profileData.lastName = lastName.trim();
    if (username.trim() && usernameStatus !== 'taken') profileData.username = username.trim();
    if (Object.keys(profileData).length > 0) {
      await SecureStore.setItemAsync('pendingProfile', JSON.stringify(profileData));
    }

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

  const needsVerification =
    signUp?.status === 'missing_requirements' &&
    (signUp?.unverifiedFields ?? []).includes('email_address') &&
    (signUp?.missingFields ?? []).length === 0;

  // ── Email verification step ────────────────────────────────────────────────
  if (needsVerification) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: topPad + 40, paddingHorizontal: 24, gap: 16 }]}>
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
          style={[styles.input, {
            backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground,
            textAlign: 'center', fontSize: 24, letterSpacing: 8,
          }]}
          maxLength={6}
        />
        {errors?.fields?.code && (
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

  // ── Sign-up form ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 20, paddingBottom: bottomPad + 20, paddingHorizontal: 24, gap: 12 }}
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
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or sign up with email</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* First + Last name row */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>First name</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Last name</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
        </View>

        {/* Username */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Username</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            value={username}
            onChangeText={handleUsernameChange}
            placeholder="spud_fan"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor:
                  usernameStatus === 'taken' ? colors.destructive
                  : usernameStatus === 'available' ? '#116149'
                  : colors.border,
                color: colors.foreground,
                paddingRight: 44,
              },
            ]}
          />
          {usernameStatus === 'checking' && (
            <ActivityIndicator
              size="small"
              color={colors.mutedForeground}
              style={{ position: 'absolute', right: 12, top: 13 }}
            />
          )}
          {usernameStatus === 'available' && (
            <Feather name="check-circle" size={18} color="#116149" style={{ position: 'absolute', right: 12, top: 14 }} />
          )}
          {usernameStatus === 'taken' && (
            <Feather name="x-circle" size={18} color={colors.destructive} style={{ position: 'absolute', right: 12, top: 14 }} />
          )}
        </View>
        {usernameStatus === 'taken' && (
          <Text style={[styles.hint, { color: colors.destructive }]}>Username already taken — try another.</Text>
        )}
        {usernameStatus === 'available' && (
          <Text style={[styles.hint, { color: '#116149' }]}>Username is available!</Text>
        )}

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
        {errors?.fields?.emailAddress && (
          <Text style={[styles.error, { color: colors.destructive }]}>{errors.fields.emailAddress.message}</Text>
        )}

        {/* Password */}
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
        {errors?.fields?.password && (
          <Text style={[styles.error, { color: colors.destructive }]}>{errors.fields.password.message}</Text>
        )}

        {/* Clerk bot protection */}
        <View nativeID="clerk-captcha" />

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: (!email || !password || isFetching || usernameStatus === 'taken') ? colors.muted : colors.primary },
          ]}
          onPress={handleSignUp}
          disabled={!email || !password || isFetching || usernameStatus === 'taken'}
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: 'Manrope_400Regular' },
  label: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.4 },
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
  hint: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: -6 },
  primaryBtn: {
    paddingVertical: 15, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  primaryBtnText: { fontSize: 16, fontFamily: 'Manrope_700Bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  footerText: { fontSize: 14, fontFamily: 'Manrope_400Regular' },
  linkText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
});
