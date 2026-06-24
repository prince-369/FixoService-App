import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { registerCustomer, clearError } from '@/store/authSlice';
import { Brand } from '@/lib/config';

export default function RegisterScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isLoading, error } = useAppSelector((s) => s.auth);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!fullName || !email || !phone || !password) return;
    dispatch(clearError());
    const result = await dispatch(registerCustomer({ fullName, email, phone, password }));
    if (registerCustomer.fulfilled.match(result)) {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Create your account</Text>
          <View style={styles.card}>
            <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="John Doe" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="9876543210" keyboard="phone-pad" />
            <Field label="Password" value={password} onChange={setPassword} placeholder="Strong password" secure />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, (isLoading || !fullName || !email || !phone || !password) && styles.disabled]}
              onPress={handleRegister}
              disabled={isLoading || !fullName || !email || !phone || !password}
            >
              {isLoading ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.buttonText}>Sign Up</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.linkRow}>
              <Text style={styles.linkMuted}>Already have an account? </Text>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, keyboard, secure }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  keyboard?: 'email-address' | 'phone-pad'; secure?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Brand.textLight}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        secureTextEntry={secure}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.navy },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { color: Brand.white, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: Brand.card, borderRadius: 24, padding: 24 },
  label: { fontSize: 12, fontWeight: '700', color: Brand.textMuted, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Brand.text,
  },
  error: { color: Brand.danger, fontSize: 13, marginTop: 12 },
  button: { backgroundColor: Brand.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  disabled: { opacity: 0.5 },
  buttonText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  linkMuted: { color: Brand.textMuted, fontSize: 13 },
  link: { color: Brand.navy, fontSize: 13, fontWeight: '700' },
});
