import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api, { getApiError } from '@/lib/api';
import { Brand } from '@/lib/config';

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentError, setCurrentError] = useState('');
  const [busy, setBusy] = useState(false);

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPwd, setResetPwd] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [showResetPwd, setShowResetPwd] = useState(false);

  const getStrength = (pwd: string) => {
    if (!pwd) return { label: '', color: Brand.textLight, score: 0 };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 2) return { label: 'Weak', color: Brand.danger, score };
    if (score <= 3) return { label: 'Medium', color: '#f59e0b', score };
    return { label: 'Strong', color: Brand.success, score };
  };

  const strength = getStrength(newPwd || resetPwd);

  const handleChangePassword = async () => {
    setCurrentError('');
    if (!currentPwd) { setCurrentError('Current password required'); return; }
    if (!newPwd) { Alert.alert('Error', 'New password required'); return; }
    if (newPwd !== confirmPwd) { Alert.alert('Error', 'Passwords do not match'); return; }
    if (strength.score < 4) { Alert.alert('Weak Password', 'Password must have 8+ chars, uppercase, lowercase, digit, special char'); return; }

    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd });
      Alert.alert('Success ✓', 'Password changed successfully!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      const msg = e?.response?.data?.message || getApiError(e, 'Failed');
      if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('wrong')) {
        setCurrentError(msg);
      } else {
        Alert.alert('Failed', msg);
      }
    } finally { setBusy(false); }
  };

  const sendForgotRequest = async () => {
    if (!forgotInput.trim()) { Alert.alert('Required', 'Email ya phone number dalein'); return; }
    setForgotBusy(true);
    try {
      const res = await api.post('/auth/forgot-password', { identifier: forgotInput.trim(), role: 'customer' });
      if (res.data.method === 'phone') {
        setOtpSent(true);
        Alert.alert('OTP Sent', 'Aapke phone pe OTP bhej diya hai');
      } else {
        Alert.alert('Reset Link Sent', 'Aapke email pe reset link bhej diya hai. Email check karein.');
        setForgotMode(false);
      }
    } catch (e) { Alert.alert('Failed', getApiError(e, 'Could not send reset request')); } finally { setForgotBusy(false); }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return;
    setForgotBusy(true);
    try {
      const res = await api.post('/auth/verify-otp', { phone: forgotInput.trim(), otp: otp.trim() });
      setResetToken(res.data.resetToken);
      Alert.alert('OTP Verified', 'Ab naya password set karein');
    } catch (e) { Alert.alert('Failed', getApiError(e, 'Invalid OTP')); } finally { setForgotBusy(false); }
  };

  const doReset = async () => {
    if (!resetPwd || resetPwd !== resetConfirm) { Alert.alert('Error', 'Passwords match nahi kar rahe'); return; }
    if (getStrength(resetPwd).score < 4) { Alert.alert('Weak', 'Strong password use karein'); return; }
    setForgotBusy(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, password: resetPwd });
      Alert.alert('Success ✓', 'Password reset ho gaya!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) { Alert.alert('Failed', getApiError(e, 'Could not reset')); } finally { setForgotBusy(false); }
  };

  if (forgotMode) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => { setForgotMode(false); setOtpSent(false); setResetToken(''); }}><Ionicons name="arrow-back" size={22} color={Brand.text} /></TouchableOpacity>
          <Text style={styles.title}>Forgot Password</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!otpSent && !resetToken && (
            <>
              <Text style={styles.desc}>Apna email ya phone number dalein. Email pe reset link jayega, phone pe OTP.</Text>
              <TextInput style={styles.input} value={forgotInput} onChangeText={setForgotInput} placeholder="Email ya phone number" placeholderTextColor={Brand.textLight} autoCapitalize="none" keyboardType="email-address" />
              <TouchableOpacity style={[styles.btn, forgotBusy && styles.disabled]} onPress={sendForgotRequest} disabled={forgotBusy}>
                {forgotBusy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.btnT}>Send Reset Request</Text>}
              </TouchableOpacity>
            </>
          )}
          {otpSent && !resetToken && (
            <>
              <Text style={styles.desc}>OTP aapke phone ({forgotInput}) pe bhej diya. Neeche enter karein.</Text>
              <TextInput style={styles.input} value={otp} onChangeText={setOtp} placeholder="Enter OTP" placeholderTextColor={Brand.textLight} keyboardType="number-pad" maxLength={6} />
              <TouchableOpacity style={[styles.btn, forgotBusy && styles.disabled]} onPress={verifyOtp} disabled={forgotBusy}>
                {forgotBusy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.btnT}>Verify OTP</Text>}
              </TouchableOpacity>
            </>
          )}
          {resetToken && (
            <>
              <Text style={styles.desc}>Naya password set karein.</Text>
              <View style={styles.pwdRow}>
                <TextInput style={[styles.input, { flex: 1 }]} value={resetPwd} onChangeText={setResetPwd} placeholder="New Password" placeholderTextColor={Brand.textLight} secureTextEntry={!showResetPwd} />
                <TouchableOpacity onPress={() => setShowResetPwd(!showResetPwd)} style={styles.eye}><Ionicons name={showResetPwd ? 'eye-off' : 'eye'} size={20} color={Brand.textMuted} /></TouchableOpacity>
              </View>
              {resetPwd ? <Text style={[styles.strength, { color: getStrength(resetPwd).color }]}>{getStrength(resetPwd).label}</Text> : null}
              <TextInput style={styles.input} value={resetConfirm} onChangeText={setResetConfirm} placeholder="Confirm New Password" placeholderTextColor={Brand.textLight} secureTextEntry />
              <TouchableOpacity style={[styles.btn, forgotBusy && styles.disabled]} onPress={doReset} disabled={forgotBusy}>
                {forgotBusy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.btnT}>Reset Password</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={Brand.text} /></TouchableOpacity>
        <Text style={styles.title}>Change Password</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Current Password</Text>
        <View style={styles.pwdRow}>
          <TextInput style={[styles.input, { flex: 1 }, currentError && styles.inputErr]} value={currentPwd} onChangeText={(v) => { setCurrentPwd(v); setCurrentError(''); }} placeholder="Enter current password" placeholderTextColor={Brand.textLight} secureTextEntry={!showCurrent} />
          <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={styles.eye}><Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color={Brand.textMuted} /></TouchableOpacity>
        </View>
        {currentError ? <Text style={styles.errT}>{currentError}</Text> : null}

        <TouchableOpacity onPress={() => setForgotMode(true)} style={styles.forgotLink}>
          <Text style={styles.forgotT}>Forgot Password?</Text>
        </TouchableOpacity>

        <Text style={styles.label}>New Password</Text>
        <View style={styles.pwdRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newPwd} onChangeText={setNewPwd} placeholder="Enter new password" placeholderTextColor={Brand.textLight} secureTextEntry={!showNew} />
          <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eye}><Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color={Brand.textMuted} /></TouchableOpacity>
        </View>
        {newPwd ? <Text style={[styles.strength, { color: strength.color }]}>{strength.label}</Text> : null}

        <Text style={styles.label}>Confirm New Password</Text>
        <View style={styles.pwdRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={confirmPwd} onChangeText={setConfirmPwd} placeholder="Re-enter new password" placeholderTextColor={Brand.textLight} secureTextEntry={!showConfirm} />
          <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eye}><Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={Brand.textMuted} /></TouchableOpacity>
        </View>
        {confirmPwd && confirmPwd !== newPwd ? <Text style={styles.errT}>Passwords match nahi kar rahe</Text> : null}

        <TouchableOpacity style={[styles.btn, busy && styles.disabled]} onPress={handleChangePassword} disabled={busy}>
          {busy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.btnT}>Update Password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Brand.card, borderBottomWidth: 1, borderBottomColor: Brand.border },
  title: { fontSize: 16, fontWeight: '800', color: Brand.text },
  scroll: { padding: 20, paddingBottom: 40 },
  desc: { fontSize: 13.5, color: Brand.textMuted, lineHeight: 20, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: Brand.textMuted, marginTop: 16, marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Brand.text },
  inputErr: { borderColor: Brand.danger },
  pwdRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  eye: { position: 'absolute', right: 12, padding: 4 },
  errT: { fontSize: 12, color: Brand.danger, marginTop: 4, fontWeight: '600' },
  strength: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  forgotLink: { alignSelf: 'flex-end', marginTop: 8 },
  forgotT: { fontSize: 13, fontWeight: '700', color: Brand.orange },
  btn: { backgroundColor: Brand.orange, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnT: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
