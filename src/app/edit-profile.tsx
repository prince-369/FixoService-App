import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import api, { getApiError } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setUser } from '@/store/authSlice';
import { Brand } from '@/lib/config';

export default function EditProfileScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bio, setBio] = useState((user as any)?.bio || '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change your picture.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  };

  const save = async () => {
    if (!fullName.trim()) return Alert.alert('Required', 'Please enter your name.');
    setSaving(true);
    try {
      const form = new FormData();
      form.append('fullName', fullName.trim());
      form.append('bio', bio.trim());
      if (photoUri) {
        const name = photoUri.split('/').pop() || 'photo.jpg';
        const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
        // @ts-expect-error React Native FormData file shape
        form.append('image', { uri: photoUri, name, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      }
      const res = await api.put('/customer/profile', form);
      if (res.data.user) dispatch(setUser(res.data.user));
      Alert.alert('Saved', 'Your profile has been updated.');
      router.back();
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not update profile'));
    } finally {
      setSaving(false);
    }
  };

  const avatar = photoUri || user?.profileImage;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={styles.avatarCard}>
            <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto} activeOpacity={0.8}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{(user?.fullName || 'U').charAt(0).toUpperCase()}</Text>
              )}
              <View style={styles.cameraBadge}><Ionicons name="camera" size={15} color={Brand.white} /></View>
            </TouchableOpacity>
            <Text style={styles.changePhoto}>Tap to change photo</Text>
          </View>

          {/* Form card */}
          <View style={styles.formCard}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor={Brand.textLight} />

            <Text style={styles.label}>Phone</Text>
            <View style={[styles.input, styles.disabledInput]}>
              <Ionicons name="lock-closed" size={14} color={Brand.textLight} />
              <Text style={styles.disabledText}>{user?.phone}</Text>
            </View>

            <Text style={styles.label}>Bio</Text>
            <TextInput style={[styles.input, styles.textarea]} value={bio} onChangeText={setBio} placeholder="A short intro..." placeholderTextColor={Brand.textLight} multiline />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: {
    backgroundColor: Brand.navy,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: Brand.navy,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 16, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 30 },
  avatarCard: { alignItems: 'center', backgroundColor: Brand.card, borderRadius: 20, borderWidth: 1, borderColor: Brand.border, paddingVertical: 22, marginBottom: 16, shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  avatarWrap: { height: 100, width: 100, borderRadius: 50, backgroundColor: Brand.navy, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { height: 100, width: 100, borderRadius: 50 },
  avatarText: { color: Brand.white, fontSize: 40, fontWeight: '800' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, height: 32, width: 32, borderRadius: 16, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Brand.card },
  changePhoto: { textAlign: 'center', color: Brand.textMuted, fontSize: 13, marginTop: 12, fontWeight: '600' },
  formCard: { backgroundColor: Brand.card, borderRadius: 20, borderWidth: 1, borderColor: Brand.border, padding: 18, shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  label: { fontSize: 12, fontWeight: '800', color: Brand.textMuted, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Brand.text },
  disabledInput: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f1f2f6' },
  disabledText: { fontSize: 15, color: Brand.textLight },
  textarea: { height: 90, textAlignVertical: 'top' },
  footer: { backgroundColor: Brand.card, borderTopWidth: 1, borderTopColor: Brand.border, paddingHorizontal: 20, paddingTop: 12 },
  saveBtn: { backgroundColor: Brand.orange, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: Brand.orange, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  saveText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
});
