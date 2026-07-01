import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginCustomer, googleAuthCustomer, clearError } from '@/store/authSlice';
import { useGoogleAuth } from '@/lib/googleAuth';
import { Brand } from '@/lib/config';
import { LOGO } from '@/lib/assets';
import api, { getApiError } from '@/lib/api';

// ─── Password Setup Modal ───
type PwStep = 'prompt' | 'otp' | 'setPassword' | 'success';

function PasswordSetupFlow({
  visible,
  onClose,
  userId,
  maskedEmail,
  role,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string;
  maskedEmail: string;
  role: 'customer' | 'worker';
}) {
  const [step, setStep] = useState<PwStep>('prompt');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setStep('prompt');
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setCountdown(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [visible]);

  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  const sendOtp = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/send-password-setup-otp', { userId, role });
      setStep('otp');
      setCountdown(60);
    } catch (err) {
      setError(getApiError(err, 'Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  const resendOtp = useCallback(async () => {
    setError('');
    try {
      await api.post('/auth/send-password-setup-otp', { userId, role });
      setCountdown(60);
    } catch (err) {
      setError(getApiError(err, 'Failed to resend OTP'));
    }
  }, [userId, role]);

  const handleSetPassword = useCallback(async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/set-password', { userId, role, otp, password });
      setStep('success');
    } catch (err) {
      setError(getApiError(err, 'Failed to set password'));
    } finally {
      setLoading(false);
    }
  }, [userId, role, otp, password, confirmPassword]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={pwStyles.overlay}>
        <View style={pwStyles.card}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {step === 'prompt' && (
              <View style={pwStyles.content}>
                <View style={[pwStyles.iconCircle, { backgroundColor: Brand.orange50 }]}>
                  <Ionicons name="shield-checkmark" size={32} color={Brand.orange} />
                </View>
                <Text style={pwStyles.title}>Set a Password</Text>
                <Text style={pwStyles.desc}>
                  Your account was created with Google Sign-In. Would you like to set a password so you can also login with email/phone?
                </Text>
                {maskedEmail ? <Text style={pwStyles.emailHint}>OTP will be sent to: {maskedEmail}</Text> : null}
                <TouchableOpacity style={pwStyles.primaryBtn} onPress={sendOtp} disabled={loading} activeOpacity={0.9}>
                  {loading ? <ActivityIndicator color={Brand.white} /> : <Text style={pwStyles.primaryText}>Yes, Set Password</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={pwStyles.secondaryBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={pwStyles.secondaryText}>No, login with Google instead</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'otp' && (
              <View style={pwStyles.content}>
                <View style={[pwStyles.iconCircle, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="mail" size={32} color="#3b82f6" />
                </View>
                <Text style={pwStyles.title}>Enter OTP</Text>
                <Text style={pwStyles.desc}>We sent a 6-digit code to your email. Enter it below.</Text>
                <TextInput
                  style={pwStyles.otpInput}
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={Brand.textLight}
                />
                {error ? <Text style={pwStyles.error}>{error}</Text> : null}
                <View style={pwStyles.timerRow}>
                  {countdown > 0 ? (
                    <Text style={pwStyles.timerText}>Resend OTP in <Text style={{ color: Brand.orange, fontWeight: '700' }}>{countdown}s</Text></Text>
                  ) : (
                    <TouchableOpacity onPress={resendOtp}><Text style={pwStyles.resendText}>Resend OTP</Text></TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={[pwStyles.primaryBtn, otp.length !== 6 && { opacity: 0.5 }]}
                  onPress={() => { setError(''); setStep('setPassword'); }}
                  disabled={otp.length !== 6}
                  activeOpacity={0.9}
                >
                  <Text style={pwStyles.primaryText}>Verify OTP</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose}><Text style={pwStyles.cancelText}>Cancel</Text></TouchableOpacity>
              </View>
            )}

            {step === 'setPassword' && (
              <View style={pwStyles.content}>
                <View style={[pwStyles.iconCircle, { backgroundColor: Brand.successBg }]}>
                  <Ionicons name="lock-closed" size={32} color={Brand.success} />
                </View>
                <Text style={pwStyles.title}>Create Password</Text>
                <Text style={pwStyles.desc}>Choose a strong password (minimum 8 characters)</Text>
                <Text style={pwStyles.fieldLabel}>New Password</Text>
                <TextInput
                  style={pwStyles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Min 8 characters"
                  placeholderTextColor={Brand.textLight}
                />
                <Text style={pwStyles.fieldLabel}>Confirm Password</Text>
                <TextInput
                  style={pwStyles.textInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Re-enter password"
                  placeholderTextColor={Brand.textLight}
                />
                {error ? <Text style={pwStyles.error}>{error}</Text> : null}
                <TouchableOpacity
                  style={[pwStyles.primaryBtn, (password.length < 8 || password !== confirmPassword) && { opacity: 0.5 }]}
                  onPress={handleSetPassword}
                  disabled={loading || password.length < 8 || password !== confirmPassword}
                  activeOpacity={0.9}
                >
                  {loading ? <ActivityIndicator color={Brand.white} /> : <Text style={pwStyles.primaryText}>Set Password</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose}><Text style={pwStyles.cancelText}>Cancel</Text></TouchableOpacity>
              </View>
            )}

            {step === 'success' && (
              <View style={pwStyles.content}>
                <View style={[pwStyles.iconCircle, { backgroundColor: Brand.successBg }]}>
                  <Ionicons name="checkmark-circle" size={40} color={Brand.success} />
                </View>
                <Text style={pwStyles.title}>Password Set!</Text>
                <Text style={pwStyles.desc}>
                  Your password has been set successfully. You can now login with your email/phone and password.
                </Text>
                <TouchableOpacity style={[pwStyles.primaryBtn, { backgroundColor: Brand.success }]} onPress={onClose} activeOpacity={0.9}>
                  <Text style={pwStyles.primaryText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const pwStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: Brand.white, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, maxHeight: '85%' },
  content: { alignItems: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: Brand.text, marginBottom: 8 },
  desc: { fontSize: 13, color: Brand.textMuted, textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  emailHint: { fontSize: 11, color: Brand.textLight, marginBottom: 16 },
  primaryBtn: { backgroundColor: Brand.orange, borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%', marginTop: 8 },
  primaryText: { color: Brand.white, fontSize: 14, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%', marginTop: 10 },
  secondaryText: { color: Brand.textMuted, fontSize: 13, fontWeight: '600' },
  otpInput: {
    width: 160, textAlign: 'center', fontSize: 24, fontWeight: '800', letterSpacing: 8,
    borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingVertical: 12,
    backgroundColor: Brand.bg, color: Brand.text, marginBottom: 12,
  },
  error: { color: Brand.danger, fontSize: 12, marginTop: 6, marginBottom: 6, textAlign: 'center' },
  timerRow: { marginBottom: 12 },
  timerText: { fontSize: 12, color: Brand.textMuted },
  resendText: { fontSize: 12, fontWeight: '700', color: Brand.orange },
  cancelText: { color: Brand.textLight, fontSize: 12, marginTop: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Brand.textMuted, alignSelf: 'flex-start', marginTop: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: {
    width: '100%', borderWidth: 1, borderColor: Brand.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Brand.text, backgroundColor: Brand.bg,
  },
});

// ─── Login Screen ───
export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isLoading, error } = useAppSelector((s) => s.auth);

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Password setup modal state
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwUserId, setPwUserId] = useState('');
  const [pwEmail, setPwEmail] = useState('');

  const [request, googleResponse, promptGoogle] = useGoogleAuth();

  // DIAGNOSTIC: prints the exact redirect URI Google must have whitelisted.
  useEffect(() => {
    if (request?.redirectUri) console.log('[google] REDIRECT URI =', request.redirectUri);
  }, [request?.redirectUri]);

  // When Google returns an id_token, hand it to the server.
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (idToken) {
        dispatch(googleAuthCustomer({ credential: idToken })).then((res) => {
          if (googleAuthCustomer.fulfilled.match(res) && (res.payload?.accessToken || res.payload?.token)) {
            router.replace('/(tabs)');
          }
        });
      }
    }
  }, [googleResponse, dispatch, router]);

  const handleLogin = async () => {
    if (!emailOrPhone.trim() || !password) return;
    dispatch(clearError());
    const result = await dispatch(loginCustomer({ emailOrPhone: emailOrPhone.trim(), password }));
    if (loginCustomer.fulfilled.match(result)) {
      router.replace('/(tabs)');
    } else if (loginCustomer.rejected.match(result)) {
      // Check if Google OAuth account needs password setup
      const payload = result.payload as any;
      if (payload?.needsPassword) {
        setPwUserId(payload.userId);
        setPwEmail(payload.email || '');
        setShowPwModal(true);
      }
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[Brand.navy, '#13284f', '#0a1430']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <Text style={styles.tagline} numberOfLines={2}>Trusted local professionals, on demand</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Welcome back 👋</Text>
              <Text style={styles.subtitle}>Sign in to book services</Text>

              <Text style={styles.label}>Email or Phone</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={Brand.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com or 9876543210"
                  placeholderTextColor={Brand.textLight}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={emailOrPhone}
                  onChangeText={setEmailOrPhone}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Brand.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="Your password"
                  placeholderTextColor={Brand.textLight}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Brand.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotRow}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={Brand.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryBtn, (isLoading || !emailOrPhone || !password) && styles.disabled]}
                onPress={handleLogin}
                disabled={isLoading || !emailOrPhone || !password}
                activeOpacity={0.9}
              >
                {isLoading ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.primaryText}>Sign In</Text>}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>

              <TouchableOpacity style={styles.googleBtn} onPress={() => promptGoogle()} activeOpacity={0.9}>
                <Image source={{ uri: 'https://www.google.com/favicon.ico' }} style={styles.googleIcon} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.linkRow}>
                <Text style={styles.linkMuted}>Don&apos;t have an account? </Text>
                <Text style={styles.link}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Password Setup Modal */}
      <PasswordSetupFlow
        visible={showPwModal}
        onClose={() => setShowPwModal(false)}
        userId={pwUserId}
        maskedEmail={pwEmail}
        role="customer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.navy },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 180, height: 64 },
  tagline: { color: '#aab8d8', fontSize: 14, marginTop: 10, textAlign: 'center', alignSelf: 'stretch' },
  card: {
    backgroundColor: Brand.card, borderRadius: 26, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: Brand.text },
  subtitle: { fontSize: 13, color: Brand.textMuted, marginTop: 4, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: Brand.textMuted, marginTop: 14, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: Brand.text },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.dangerBg, borderRadius: 10, padding: 10, marginTop: 14 },
  errorText: { color: Brand.danger, fontSize: 12.5, flex: 1 },
  primaryBtn: { backgroundColor: Brand.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  disabled: { opacity: 0.5 },
  primaryText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  divider: { flex: 1, height: 1, backgroundColor: Brand.border },
  dividerText: { color: Brand.textLight, fontSize: 12 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Brand.white, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingVertical: 14,
  },
  googleIcon: { width: 18, height: 18 },
  googleText: { color: Brand.text, fontSize: 14.5, fontWeight: '700' },
  forgotRow: { alignSelf: 'flex-end', marginTop: 10 },
  forgotText: { color: Brand.orange, fontSize: 12.5, fontWeight: '700' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkMuted: { color: Brand.textMuted, fontSize: 13 },
  link: { color: Brand.orange, fontSize: 13, fontWeight: '800' },
});
