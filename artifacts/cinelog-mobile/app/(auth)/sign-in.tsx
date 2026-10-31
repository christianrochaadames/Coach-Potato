import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ControlledPlaceholderInput as TextInput } from '@/components/ControlledPlaceholderInput';

function getClerkErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Something went wrong. Please try again.';
}

type AuthMode = 'signIn' | 'forgot';
type ResetStep = 'email' | 'code' | 'password';

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('signIn');
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const isFetching = fetchStatus === 'fetching';

  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  const finishSignIn = async () => {
    await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl('/');
        if (!url.startsWith('http')) router.replace(url as any);
      },
    });
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setActionError(null);
    const { error } = await signIn.password({
      identifier: email.trim(),
      password,
    });
    if (error) {
      setActionError(getClerkErrorMessage(error));
      return;
    }
    if (signIn.status === 'complete') {
      await finishSignIn();
    } else if (signIn.status === 'needs_second_factor') {
      setActionError('This account needs an additional verification step.');
    } else {
      setActionError('We could not complete sign-in. Please try again.');
    }
  };

  const openForgotPassword = () => {
    setActionError(null);
    setAuthMode('forgot');
    setResetStep('email');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const backToSignIn = async () => {
    setActionError(null);
    await signIn.reset();
    setAuthMode('signIn');
    setResetStep('email');
  };

  const sendResetCode = async () => {
    if (!email.trim()) {
      setActionError('Enter your email address first.');
      return;
    }
    setActionError(null);
    const { error: createError } = await signIn.create({
      identifier: email.trim(),
    });
    if (createError) {
      setActionError(getClerkErrorMessage(createError));
      return;
    }

    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    if (sendError) {
      setActionError(getClerkErrorMessage(sendError));
      return;
    }
    setResetStep('code');
  };

  const verifyResetCode = async () => {
    if (resetCode.trim().length < 6) {
      setActionError('Enter the 6-digit code from your email.');
      return;
    }
    setActionError(null);
    const { error } = await signIn.resetPasswordEmailCode.verifyCode({
      code: resetCode.trim(),
    });
    if (error) {
      setActionError(getClerkErrorMessage(error));
      return;
    }
    setResetStep('password');
  };

  const submitNewPassword = async () => {
    if (newPassword.length < 8) {
      setActionError('Your new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setActionError('The passwords do not match.');
      return;
    }
    setActionError(null);
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({
      password: newPassword,
      signOutOfOtherSessions: true,
    });
    if (error) {
      setActionError(getClerkErrorMessage(error));
      return;
    }
    if (signIn.status === 'complete') {
      await finishSignIn();
    } else {
      setActionError('Your password was updated, but sign-in did not finish. Please sign in again.');
      setAuthMode('signIn');
    }
  };

  const errorMsg =
    actionError ??
    errors?.fields?.identifier?.message ??
    errors?.fields?.password?.message ??
    null;

  if (authMode === 'forgot') {
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
            <View style={styles.brandRow}>
              <Image
                source={require('@/assets/images/spud-logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
              <Image
                source={require('@/assets/images/spud-signin-new.png')}
                style={styles.mascotImg}
                resizeMode="contain"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {resetStep === 'email'
                  ? 'Reset your password'
                  : resetStep === 'code'
                    ? 'Check your email'
                    : 'Choose a new password'}
              </Text>
              <Text style={styles.cardSub}>
                {resetStep === 'email'
                  ? "We'll send a verification code to get you back into Spud."
                  : resetStep === 'code'
                    ? `Enter the 6-digit code we sent to ${email.trim()}.`
                    : 'Create a new password for your Spud account.'}
              </Text>

              {resetStep === 'email' ? (
                <>
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
                      autoCorrect={false}
                      autoComplete="email"
                      returnKeyType="done"
                      onSubmitEditing={sendResetCode}
                    />
                  </View>
                  {errorMsg ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}
                  <View nativeID="clerk-captcha" />
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={sendResetCode}
                    disabled={isFetching || !email.trim()}
                    activeOpacity={0.85}
                  >
                    {isFetching ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnPrimaryText}>Send reset code</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : resetStep === 'code' ? (
                <>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="000000"
                    placeholderTextColor="#A09898"
                    placeholderStyle={{
                      fontSize: 28,
                      fontFamily: 'Manrope_700Bold',
                      textAlign: 'center',
                      letterSpacing: 8,
                    }}
                    value={resetCode}
                    onChangeText={setResetCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  {errorMsg ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={verifyResetCode}
                    disabled={isFetching || resetCode.trim().length < 6}
                    activeOpacity={0.85}
                  >
                    {isFetching ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnPrimaryText}>Verify code</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={sendResetCode}
                    disabled={isFetching}
                    style={styles.secondaryAction}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.linkText}>Resend code</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>New password</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="At least 8 characters"
                      placeholderTextColor="#A09898"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      autoComplete="new-password"
                    />
                  </View>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Confirm new password</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter it again"
                      placeholderTextColor="#A09898"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      autoComplete="new-password"
                      returnKeyType="done"
                      onSubmitEditing={submitNewPassword}
                    />
                  </View>
                  {errorMsg ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={submitNewPassword}
                    disabled={isFetching || !newPassword || !confirmPassword}
                    activeOpacity={0.85}
                  >
                    {isFetching ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnPrimaryText}>Set new password</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                onPress={backToSignIn}
                disabled={isFetching}
                style={styles.switchRow}
                activeOpacity={0.7}
              >
                <Text style={styles.switchText}>
                  Back to <Text style={styles.switchLink}>sign in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

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
              source={require('@/assets/images/spud-signin-new.png')}
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
                      placeholder="bingingforever123!"
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
              style={styles.btnPrimary}
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

            {/* Password recovery */}
            <TouchableOpacity
              onPress={openForgotPassword}
              disabled={isFetching}
              style={styles.forgotRow}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot your password?</Text>
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
  // The new illustration has about 22 px of transparent space on the right
  // when fitted into this slot, so its visible edge stays flush with the card.
  mascotImg: { height: 110, width: 110, transform: [{ translateX: 22 }] },

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
    fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#111111', letterSpacing: 0,
  },

  errorBox: {
    backgroundColor: '#FEE2E2', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  errorText: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#DC2626' },

  btnPrimary: {
    backgroundColor: '#5950C7', borderRadius: 24,
    paddingVertical: 14, alignItems: 'center', marginBottom: 16, marginTop: 4,
  },
  btnPrimaryText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  switchRow: { alignItems: 'center', marginTop: 8 },
  switchText: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#7E7A73' },
  switchLink: { fontFamily: 'Manrope_700Bold', color: '#5B50D0' },
  forgotRow: { alignItems: 'center', marginBottom: 4 },
  forgotText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: '#5B50D0' },
  secondaryAction: { alignItems: 'center', marginTop: 2, marginBottom: 2 },
  linkText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: '#5B50D0' },
  codeInput: {
    backgroundColor: '#FFF3E8', borderRadius: 12, borderWidth: 1.5, borderColor: '#5B50D0',
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 14,
    fontSize: 28, fontFamily: 'Manrope_700Bold', color: '#111111',
    textAlign: 'center', letterSpacing: 8,
  },
});
