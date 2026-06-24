import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
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

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isLoading, error } = useAppSelector((s) => s.auth);

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

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
    if (loginCustomer.fulfilled.match(result)) router.replace('/(tabs)');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[Brand.navy, '#13284f', '#0a1430']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <Text style={styles.tagline}>Trusted local professionals, on demand</Text>
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
                <TouchableOpacity onPress={() => setShowPass((v) => !v)}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Brand.textLight} />
                </TouchableOpacity>
              </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.navy },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 180, height: 64 },
  tagline: { color: '#aab8d8', fontSize: 13, marginTop: 10 },
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
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkMuted: { color: Brand.textMuted, fontSize: 13 },
  link: { color: Brand.orange, fontSize: 13, fontWeight: '800' },
});
