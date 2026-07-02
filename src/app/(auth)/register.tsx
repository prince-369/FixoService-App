import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { registerCustomer, googleAuthCustomer, clearError } from '@/store/authSlice';
import { signInWithGoogle, statusCodes } from '@/lib/googleAuth';
import { Brand } from '@/lib/config';
import { LOGO } from '@/lib/assets';

// Password strength rules
const PASSWORD_RULES = [
  { label: 'Minimum 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];
const isStrongPassword = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

export default function RegisterScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isLoading, error } = useAppSelector((s) => s.auth);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const passwordStrong = isStrongPassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = fullName && email && phone && passwordStrong && passwordsMatch;

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
      const idToken = await signInWithGoogle();
      const res = await dispatch(googleAuthCustomer({ credential: idToken }));
      if (googleAuthCustomer.fulfilled.match(res) && (res.payload?.accessToken || res.payload?.token)) {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      if (e?.code !== statusCodes.SIGN_IN_CANCELLED) {
        console.log('[Google Register] error:', e?.message);
      }
    } finally {
      setGoogleLoading(false);
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
              <Text style={styles.tagline}>Book trusted local workers for household services</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>Sign up to get started</Text>

              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={Brand.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={Brand.textLight}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Brand.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Brand.textLight}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <Text style={styles.label}>Phone</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={Brand.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="9876543210"
                  placeholderTextColor={Brand.textLight}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Brand.textLight} />
                <TextInput
                  style={styles.input}
                  placeholder="Strong password"
                  placeholderTextColor={Brand.textLight}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Brand.textMuted} />
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

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={Brand.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryBtn, (!canSubmit || isLoading) && styles.disabled]}
                onPress={handleRegister}
                disabled={!canSubmit || isLoading}
                activeOpacity={0.9}
              >
                {isLoading ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.primaryText}>Sign Up</Text>}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.navy },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 24, width: '100%' },
  logo: { width: 170, height: 60 },
  tagline: { color: '#aab8d8', fontSize: 13, marginTop: 8, textAlign: 'center', alignSelf: 'stretch' },
  card: {
    backgroundColor: Brand.card, borderRadius: 26, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: Brand.text },
  subtitle: { fontSize: 13, color: Brand.textMuted, marginTop: 4, marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: Brand.textMuted, marginTop: 14, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: Brand.text },
  rules: { marginTop: 10, gap: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleIcon: { fontSize: 13, color: Brand.textLight, fontWeight: '700', width: 16, textAlign: 'center' },
  ruleIconOk: { color: Brand.success },
  ruleText: { fontSize: 12, color: Brand.textLight },
  ruleTextOk: { color: Brand.success },
  mismatch: { color: Brand.danger, fontSize: 12, marginTop: 6 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.dangerBg, borderRadius: 10, padding: 10, marginTop: 14 },
  errorText: { color: Brand.danger, fontSize: 12.5, flex: 1 },
  primaryBtn: { backgroundColor: Brand.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  disabled: { opacity: 0.5 },
  primaryText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 18, marginBottom: 4 },
  linkMuted: { color: '#aab8d8', fontSize: 13 },
  link: { color: Brand.orange, fontSize: 13, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  divider: { flex: 1, height: 1, backgroundColor: Brand.border },
  dividerText: { color: Brand.textLight, fontSize: 12, marginHorizontal: 12 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Brand.white, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingVertical: 14 },
  googleIcon: { width: 18, height: 18 },
  googleText: { fontSize: 14, fontWeight: '700', color: Brand.text },
});
