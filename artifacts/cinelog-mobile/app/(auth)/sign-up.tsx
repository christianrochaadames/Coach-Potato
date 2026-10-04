import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as SecureStore from 'expo-secure-store';
import { useSignUp } from '@clerk/expo';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ControlledPlaceholderInput as TextInput } from '@/components/ControlledPlaceholderInput';
import { savePendingProfile } from '@/utils/pendingProfile';

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app'}`;

async function checkUsernameAvailability(username: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/check-username?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    return data.available === true;
  } catch {
    return true;
  }
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const [firstName, setFirstName]       = useState('');
  const [lastName, setLastName]         = useState('');
  const [username, setUsername]         = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode]                 = useState('');
  const [formErrors, setFormErrors]     = useState<{
    firstName?: string; lastName?: string; username?: string;
  }>({});

  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetching = fetchStatus === 'fetching';

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

  const handleSignUp = async () => {
    const nextErrors: typeof formErrors = {};
    if (!firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!lastName.trim()) nextErrors.lastName = 'Last name is required.';
    if (!username.trim()) nextErrors.username = 'Username is required.';
    else if (username.trim().length < 2) nextErrors.username = 'Username must be at least 2 characters.';
    if (usernameStatus === 'taken') nextErrors.username = 'Choose an available username.';
    setFormErrors(nextErrors);
    if (!email || !password || Object.keys(nextErrors).length > 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    const profileData: Record<string, string> = {};
    if (firstName.trim()) profileData.firstName = firstName.trim();
    if (lastName.trim()) profileData.lastName = lastName.trim();
    if (username.trim() && usernameStatus !== 'taken') profileData.username = username.trim();
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === 'complete') {
      const createdUserId = signUp.createdUserId;
      if (createdUserId && Object.keys(profileData).length > 0) {
        try {
          await savePendingProfile(SecureStore, createdUserId, profileData);
        } catch {
          // Profile setup is best-effort; do not block account creation.
        }
      }
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/onboarding');
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
      <KeyboardAvoidingView style={styles.verifyKeyboard} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          contentContainerStyle={[
            styles.verifyScrollContent,
            { paddingTop: topInset + 40, paddingBottom: bottomInset + 20 },
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.verifyRoot}>
            <View style={styles.brand}>
              <Image source={require('@/assets/images/spud-logo-verification.png')} style={styles.verifyLogo} resizeMode="contain" />
            </View>
            <Text style={styles.verifyTitle}>Check your email</Text>
            <Text style={styles.verifySubtitle}>We sent a 6-digit code to {email}</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor="#A09898"
              placeholderStyle={{
                fontSize: 28,
                fontFamily: 'Manrope_700Bold',
                textAlign: 'center',
                letterSpacing: 8,
              }}
              keyboardType="numeric"
              style={styles.codeInput}
              maxLength={6}
              autoFocus
            />
            {errors?.fields?.code && (
              <Text style={styles.error}>{errors.fields.code.message}</Text>
            )}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleVerify}
              disabled={isFetching || code.length !== 6}
              activeOpacity={0.8}
            >
              {isFetching ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.primaryBtnText}>Verify email</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => signUp.verifications.sendEmailCode()}
              activeOpacity={0.7}
              style={{ alignItems: 'center', marginTop: 8 }}
            >
              <Text style={styles.linkText}>Resend code</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Sign-up form ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#C5B8FF' }}
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topInset + 16, paddingBottom: bottomInset + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Branding */}
        <View style={styles.brandRow}>
          <Image source={require('@/assets/images/spud-logo.png')} style={styles.logoImg} resizeMode="contain" />
          <Image source={require('@/assets/images/spud-signup-new.png')} style={styles.mascotImg} resizeMode="contain" />
        </View>

        {/* White card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create your account</Text>
          <Text style={styles.cardSub}>Start tracking what you watch.</Text>

          {/* First + Last name */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>First name</Text>
              <TextInput
                value={firstName} onChangeText={setFirstName}
                placeholder="Sam" placeholderTextColor="#A09898"
                autoCorrect={false} style={styles.input}
              />
              {formErrors.firstName ? <Text style={styles.error}>{formErrors.firstName}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Last name</Text>
              <TextInput
                value={lastName} onChangeText={setLastName}
                placeholder="Taylor" placeholderTextColor="#A09898"
                autoCorrect={false} style={styles.input}
              />
              {formErrors.lastName ? <Text style={styles.error}>{formErrors.lastName}</Text> : null}
            </View>
          </View>
          {formErrors.username ? <Text style={styles.error}>{formErrors.username}</Text> : null}

          {/* Username */}
          <Text style={styles.fieldLabel}>Username</Text>
          <View style={{ position: 'relative', marginBottom: 4 }}>
            <TextInput
              value={username}
              onChangeText={handleUsernameChange}
              placeholder="spud_fan"
              placeholderTextColor="#A09898"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                usernameStatus === 'taken' && { borderColor: '#DC2626' },
                usernameStatus === 'available' && { borderColor: '#116149' },
                { paddingRight: 44 },
              ]}
            />
            {usernameStatus === 'checking' && (
              <ActivityIndicator size="small" color="#A09898" style={{ position: 'absolute', right: 12, top: 14 }} />
            )}
            {usernameStatus === 'available' && (
              <Feather name="check-circle" size={18} color="#116149" style={{ position: 'absolute', right: 12, top: 14 }} />
            )}
            {usernameStatus === 'taken' && (
              <Feather name="x-circle" size={18} color="#DC2626" style={{ position: 'absolute', right: 12, top: 14 }} />
            )}
          </View>
          {usernameStatus === 'taken' && <Text style={[styles.hint, { color: '#DC2626' }]}>Username already taken.</Text>}
          {usernameStatus === 'available' && <Text style={[styles.hint, { color: '#116149' }]}>Username is available!</Text>}

          {/* Email */}
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={email} onChangeText={setEmail}
            placeholder="you@example.com" placeholderTextColor="#A09898"
            autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
            style={styles.input}
          />
          {errors?.fields?.emailAddress && (
            <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>
          )}

          {/* Password */}
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password} onChangeText={setPassword}
              placeholder="OneMoreEpisode!" placeholderTextColor="#A09898"
              secureTextEntry={!showPassword}
              containerStyle={{ flex: 1 }}
              placeholderStyle={{ paddingHorizontal: 0 }}
              style={styles.passwordInput}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} activeOpacity={0.7}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#A09898" />
            </TouchableOpacity>
          </View>
          {errors?.fields?.password && (
            <Text style={styles.error}>{errors.fields.password.message}</Text>
          )}

          {/* Clerk bot protection */}
          <View nativeID="clerk-captcha" />

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSignUp}
            disabled={!email || !password || isFetching || usernameStatus === 'taken'}
            activeOpacity={0.8}
          >
            {isFetching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Create account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.linkText}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Verify screen
  verifyRoot: {
    backgroundColor: '#C5B8FF',
    paddingHorizontal: 24, gap: 12,
  },
  verifyKeyboard: { flex: 1, backgroundColor: '#C5B8FF' },
  verifyScrollContent: { flexGrow: 1 },
  verifyLogo: { width: 200, height: 110, alignSelf: 'center' },
  verifyTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: '#111111', textAlign: 'center' },
  verifySubtitle: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: '#111111', textAlign: 'center', opacity: 0.7 },
  codeInput: {
    borderRadius: 16, borderWidth: 2, borderColor: '#5B50D0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14, paddingVertical: 16,
    fontSize: 28, fontFamily: 'Manrope_700Bold', color: '#111111',
    textAlign: 'center', letterSpacing: 8,
  },

  // Sign-up form
  container: { alignItems: 'center', paddingHorizontal: 20 },
  brandRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%', maxWidth: 440, marginBottom: 16,
  },
  logoImg: { height: 90, width: 160 },
  // The new illustration has 10 px of transparent space on the right when
  // fitted into this slot, so its visible edge stays flush with the card.
  mascotImg: { height: 110, width: 100, transform: [{ translateX: 10 }] },
  brand: { alignItems: 'center', marginBottom: 16 },

  card: {
    width: '100%', maxWidth: 440,
    backgroundColor: '#ffffff', borderRadius: 24, padding: 24, gap: 10,
  },
  cardTitle: { fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#111111' },
  cardSub: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: '#7E7A73', marginBottom: 4 },

  nameRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: '#111111', marginBottom: 6 },
  input: {
    backgroundColor: '#FFF3E8', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2D9CE',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#111111', letterSpacing: 0, marginBottom: 10,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF3E8', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2D9CE',
    paddingHorizontal: 14, paddingVertical: 12, gap: 8, marginBottom: 10,
  },
  passwordInput: { flex: 1, fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#111111', padding: 0, letterSpacing: 0 },

  primaryBtn: {
    backgroundColor: '#5950C7', borderRadius: 24,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  error: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#DC2626', marginTop: -6 },
  hint: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: -8 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  footerText: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },
  linkText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: '#5B50D0' },
});
