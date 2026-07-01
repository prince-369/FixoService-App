import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Brand } from '@/lib/config';
import { LOGO } from '@/lib/assets';
import api, { getApiError } from '@/lib/api';

const ROLE = 'customer';

// Password strength rules
const PASSWORD_RULES = [
  { label: 'Minimum 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];
const isStrongPassword = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

type Step = 'identifier' | 'email-sent' | 'otp' | 'new-password' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());

  const handleSendReset = useCallback(async () => {
    if (!identifier.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot-password', { identifier: identifier.trim(), role: ROLE });
      if (isEmail) {
        setStep('email-sent');
      } else {
        // Phone - expect OTP flow
        setToken(res.data?.token || '');
        setStep('otp');
        setCountdown(60);
      }
    } catch (err) {
      setError(getApiError(err, 'Failed to send reset request'));
    } finally {
      setLoading(false);
    }
  }, [identifier, isEmail]);

  const handleResendOtp = useCallback(async () => {
    setError('');
    try {
      const res = await api.post('/auth/forgot-password', { identifier: identifier.trim(), role: ROLE });
      setToken(res.data?.token || token);
      setCountdown(60);
    } catch (err) {
      setError(getApiError(err, 'Failed to resend OTP'));
    }
  }, [identifier, token]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-otp', { identifier: identifier.trim(), otp, role: ROLE });
      setToken(res.data?.token || token);
      setStep('new-password');
    } catch (err) {
      setError(getApiError(err, 'Invalid OTP'));
    } finally {
      setLoading(false);
    }
  }, [otp, identifier, token]);

  const handleResetPassword = useCallback(async () => {
    if (!isStrongPassword(password)) { setError('Password does not meet requirements'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setStep('success');
    } catch (err) {
      setError(getApiError(err, 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  }, [token, password, confirmPassword]);

  const passwordStrong = isStrongPassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[Brand.navy, '#13284f', '#0a1430']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <Text style={styles.tagline}>Trusted local professionals, on demand</Text>
            </View>

            <View style={styles.card}>
              {step === 'identifier' && (
                <>
                  <View style={styles.iconCircle}>
                    <Ionicons name="lock-open-outline" size={28} color={Brand.orange} />
                  </View>
                  <Text style={styles.title}>Forgot Password?</Text>
                  <Text style={styles.subtitle}>Enter your email or phone number to reset your password</Text>

                  <Text style={styles.label}>Email or Phone</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={Brand.textLight} />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com or 9876543210"
                      placeholderTextColor={Brand.textLight}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={identifier}
                      onChangeText={setIdentifier}
                    />
                  </View>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[styles.primaryBtn, (!identifier.trim() || loading) && styles.disabled]}
                    onPress={handleSendReset}
                    disabled={!identifier.trim() || loading}
                    activeOpacity={0.9}
                  >
                    {loading ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.primaryText}>Send Reset Link</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
                    <Ionicons name="arrow-back" size={14} color={Brand.textMuted} />
                    <Text style={styles.backText}> Back to Login</Text>
                  </TouchableOpacity>
                </>
              )}

              {step === 'email-sent' && (
                <>
                  <View style={[styles.iconCircle, { backgroundColor: Brand.successBg }]}>
                    <Ionicons name="mail-open-outline" size={28} color={Brand.success} />
                  </View>
                  <Text style={styles.title}>Check Your Email</Text>
                  <Text style={styles.subtitle}>
                    We sent a password reset link to your email. Please check your inbox and follow the link to reset your password.
                  </Text>

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: Brand.success }]}
                    onPress={() => router.back()}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryText}>Back to Login</Text>
                  </TouchableOpacity>
                </>
              )}

              {step === 'otp' && (
                <>
                  <View style={[styles.iconCircle, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons name="keypad-outline" size={28} color="#3b82f6" />
                  </View>
                  <Text style={styles.title}>Enter OTP</Text>
                  <Text style={styles.subtitle}>We sent a 6-digit code to your phone. Enter it below.</Text>

                  <TextInput
                    style={styles.otpInput}
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="000000"
                    placeholderTextColor={Brand.textLight}
                  />

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <View style={styles.timerRow}>
                    {countdown > 0 ? (
                      <Text style={styles.timerText}>Resend OTP in <Text style={{ color: Brand.orange, fontWeight: '700' }}>{countdown}s</Text></Text>
                    ) : (
                      <TouchableOpacity onPress={handleResendOtp}><Text style={styles.resendText}>Resend OTP</Text></TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, (otp.length !== 6 || loading) && styles.disabled]}
                    onPress={handleVerifyOtp}
                    disabled={otp.length !== 6 || loading}
                    activeOpacity={0.9}
                  >
                    {loading ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.primaryText}>Verify OTP</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setStep('identifier')} style={styles.backRow}>
                    <Ionicons name="arrow-back" size={14} color={Brand.textMuted} />
                    <Text style={styles.backText}> Change number</Text>
                  </TouchableOpacity>
                </>
              )}

              {step === 'new-password' && (
                <>
                  <View style={[styles.iconCircle, { backgroundColor: Brand.successBg }]}>
                    <Ionicons name="lock-closed-outline" size={28} color={Brand.success} />
                  </View>
                  <Text style={styles.title}>Create New Password</Text>
                  <Text style={styles.subtitle}>Choose a strong password for your account</Text>

                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={Brand.textLight} />
                    <TextInput
                      style={styles.input}
                      placeholder="New password"
                      placeholderTextColor={Brand.textLight}
                      secureTextEntry={!showPass}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Brand.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {password.length > 0 && (
                    <View style={styles.rules}>
                      {PASSWORD_RULES.map((r) => {
                        const ok = r.test(password);
                        return (
                          <View key={r.label} style={styles.ruleRow}>
                            <Text style={[styles.ruleIcon, ok && styles.ruleIconOk]}>{ok ? '✓' : '✗'}</Text>
                            <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{r.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={Brand.textLight} />
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter password"
                      placeholderTextColor={Brand.textLight}
                      secureTextEntry={!showConfirmPass}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPass((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Brand.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <Text style={styles.mismatch}>Passwords do not match</Text>
                  )}

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[styles.primaryBtn, (!passwordStrong || !passwordsMatch || loading) && styles.disabled]}
                    onPress={handleResetPassword}
                    disabled={!passwordStrong || !passwordsMatch || loading}
                    activeOpacity={0.9}
                  >
                    {loading ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.primaryText}>Reset Password</Text>}
                  </TouchableOpacity>
                </>
              )}

              {step === 'success' && (
                <>
                  <View style={[styles.iconCircle, { backgroundColor: Brand.successBg }]}>
                    <Ionicons name="checkmark-circle" size={36} color={Brand.success} />
                  </View>
                  <Text style={styles.title}>Password Reset!</Text>
                  <Text style={styles.subtitle}>
                    Your password has been reset successfully. You can now sign in with your new password.
                  </Text>

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: Brand.success }]}
                    onPress={() => router.replace('/(auth)/login')}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryText}>Back to Login</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.navy },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 170, height: 60 },
  tagline: { color: '#aab8d8', fontSize: 13, marginTop: 8, textAlign: 'center', alignSelf: 'stretch' },
  card: {
    backgroundColor: Brand.card, borderRadius: 26, padding: 24, paddingBottom: 40,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Brand.orange50, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Brand.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: Brand.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 19 },
  label: { fontSize: 11, fontWeight: '700', color: Brand.textMuted, marginTop: 14, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: Brand.text },
  otpInput: {
    alignSelf: 'center', width: 180, textAlign: 'center', fontSize: 24, fontWeight: '800', letterSpacing: 8,
    borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingVertical: 12,
    backgroundColor: Brand.bg, color: Brand.text, marginBottom: 12,
  },
  rules: { marginTop: 10, gap: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleIcon: { fontSize: 13, color: Brand.textLight, fontWeight: '700', width: 16, textAlign: 'center' },
  ruleIconOk: { color: Brand.success },
  ruleText: { fontSize: 12, color: Brand.textLight },
  ruleTextOk: { color: Brand.success },
  mismatch: { color: Brand.danger, fontSize: 12, marginTop: 6 },
  error: { color: Brand.danger, fontSize: 12.5, marginTop: 12, textAlign: 'center' },
  primaryBtn: { backgroundColor: Brand.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  disabled: { opacity: 0.5 },
  primaryText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
  timerRow: { alignItems: 'center', marginBottom: 4 },
  timerText: { fontSize: 12, color: Brand.textMuted },
  resendText: { fontSize: 12, fontWeight: '700', color: Brand.orange },
  backRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  backText: { color: Brand.text, fontSize: 13 },
});
