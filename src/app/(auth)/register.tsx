import { useState, useMemo } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { registerCustomer, googleAuthCustomer, completeGoogleCustomer, clearError } from '@/store/authSlice';
import { signInWithGoogle, statusCodes, GOOGLE_UNAVAILABLE } from '@/lib/googleAuth';
import { LOGO } from '@/lib/assets';
import { useTheme, type ThemeColors } from '@/lib/theme';

// Password strength rules
const PASSWORD_RULES = [
  { label: 'Minimum 8 characters', test: (p: string) => p.length >= 8 && p.length <= 64 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];
const isStrongPassword = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

export default function RegisterScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isLoading, error } = useAppSelector((s) => s.auth);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const passwordStrong = isStrongPassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  // Mirrors the server rule (/^[6-9]\d{9}$/) so an invalid number is caught here
  // instead of costing a round-trip and a scary-looking API error.
  const phoneValid = /^[6-9]\d{9}$/.test(phone.trim());
  const canSubmit = Boolean(fullName && email && phoneValid && passwordStrong && passwordsMatch);

  const handleRegister = async () => {
    if (!canSubmit) return;
    dispatch(clearError());
    const result = await dispatch(registerCustomer({ fullName, email, phone, password }));
    if (registerCustomer.fulfilled.match(result)) {
      router.replace('/(tabs)');
    }
  };

  const [googleLoading, setGoogleLoading] = useState(false);
  const handleGoogleSignUp = async () => {
    try {
      setGoogleLoading(true);
      dispatch(clearError());
      const idToken = await signInWithGoogle();
      const res = await dispatch(googleAuthCustomer({ credential: idToken }));
      if (!googleAuthCustomer.fulfilled.match(res)) return;

      const p: any = res.payload;
      // Existing user → straight in.
      if (p?.accessToken || p?.token) { router.replace('/(tabs)'); return; }

      // New Google user → server needs a phone number to create the account.
      if (p?.needsPhone) {
        const gd = p.googleData || p;
        const ph = phone.trim();
        if (!ph) {
          Alert.alert('Phone number needed', 'Apna phone number upar daalein, phir "Continue with Google" dobara dabayein — account ban jayega.');
          return;
        }
        const done = await dispatch(completeGoogleCustomer({
          phone: ph, email: gd.email, fullName: gd.fullName, googleId: gd.googleId, profileImage: gd.profileImage,
        }));
        if (completeGoogleCustomer.fulfilled.match(done) && (done.payload?.accessToken || done.payload?.token)) {
          router.replace('/(tabs)');
        }
      }
    } catch (e: any) {
      if (e?.code === GOOGLE_UNAVAILABLE) {
        // Expected in Expo Go — not a bug, so don't dress it up as one.
        Alert.alert('Not available here', `${e.message}\n\nUse email/phone sign up instead.`);
      } else if (e?.code !== statusCodes.SIGN_IN_CANCELLED) {
        console.log('[Google Register] error:', e?.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.navy, '#13284f', '#0a1430']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <Text style={styles.tagline}>Book trusted local workers for household services</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>Sign up to get started</Text>

              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textLight}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <Text style={styles.label}>Phone</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="9876543210"
                  placeholderTextColor={colors.textLight}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  // Digits only — a stray space or "+91" is the usual cause of a
                  // rejected number, so strip it as they type.
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                />
              </View>
              {phone.length > 0 && !phoneValid && (
                <Text style={styles.phoneHint}>
                  Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.
                </Text>
              )}

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="Strong password"
                  placeholderTextColor={colors.textLight}
                  secureTextEntry={!showPass}
                  maxLength={64}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Password strength indicator */}
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
                <Ionicons name="lock-closed-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.textLight}
                  secureTextEntry={!showPass}
                  maxLength={64}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {confirmPassword.length > 0 && !passwordsMatch && (
                <Text style={styles.mismatch}>Passwords do not match</Text>
              )}

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryBtn, (!canSubmit || isLoading) && styles.disabled]}
                onPress={handleRegister}
                disabled={!canSubmit || isLoading}
                activeOpacity={0.9}
              >
                {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Sign Up</Text>}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>

              <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignUp} activeOpacity={0.9} disabled={googleLoading}>
                <Image source={{ uri: 'https://www.google.com/favicon.ico' }} style={styles.googleIcon} />
                <Text style={styles.googleText}>{googleLoading ? 'Signing up...' : 'Sign up with Google'}</Text>
              </TouchableOpacity>

            </View>

            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.linkRow}>
              <Text style={styles.linkMuted}>Already have an account? </Text>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.navy },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 24, width: '100%' },
  logo: { width: 170, height: 60 },
  tagline: { color: '#aab8d8', fontSize: 13, marginTop: 8, textAlign: 'center', alignSelf: 'stretch' },
  card: {
    backgroundColor: c.card, borderRadius: 26, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: c.text },
  subtitle: { fontSize: 13, color: c.textMuted, marginTop: 4, marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: c.textMuted, marginTop: 14, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: c.text },
  phoneHint: { fontSize: 11.5, color: c.danger, marginTop: 6, lineHeight: 16 },
  rules: { marginTop: 10, gap: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleIcon: { fontSize: 13, color: c.textLight, fontWeight: '700', width: 16, textAlign: 'center' },
  ruleIconOk: { color: c.success },
  ruleText: { fontSize: 12, color: c.textLight },
  ruleTextOk: { color: c.success },
  mismatch: { color: c.danger, fontSize: 12, marginTop: 6 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.dangerBg, borderRadius: 10, padding: 10, marginTop: 14 },
  errorText: { color: c.danger, fontSize: 12.5, flex: 1 },
  primaryBtn: { backgroundColor: c.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  disabled: { opacity: 0.5 },
  primaryText: { color: c.white, fontSize: 15, fontWeight: '700' },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 18, marginBottom: 4 },
  linkMuted: { color: '#aab8d8', fontSize: 13 },
  link: { color: c.orange, fontSize: 13, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  divider: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { color: c.textLight, fontSize: 12, marginHorizontal: 12 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 14 },
  googleIcon: { width: 18, height: 18 },
  googleText: { fontSize: 14, fontWeight: '700', color: c.text },
});
