import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import api, { getApiError } from '@/lib/api';
import { Brand } from '@/lib/config';
import { consumePickedLocation } from '@/lib/locationBridge';

// expo-speech-recognition is a native module (not in Expo Go) — only load it in a real build.
const isExpoGo =
  Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

const SLOTS = [
  { key: 'anytime', label: 'Anytime' },
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
] as const;

export default function NewBookingScreen() {
  const { category, name } = useLocalSearchParams<{ category: string; name?: string }>();
  const router = useRouter();

  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [slot, setSlot] = useState<string>('anytime');
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Voice
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [listening, setListening] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const speechSubs = useRef<{ remove: () => void }[]>([]);
  const speechBase = useRef('');

  // Pick up a location chosen on the map screen when we return to this screen.
  useFocusEffect(useCallback(() => {
    const picked = consumePickedLocation();
    if (picked) {
      setCoords({ lat: picked.lat, lng: picked.lng });
      setAddress(picked.address);
    }
  }, []));

  // ── Voice note recording (works in Expo Go) ──
  const startRec = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert('Permission needed', 'Allow microphone access to record a voice note.'); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch { Alert.alert('Error', 'Could not start recording.'); }
  };

  const stopRec = async () => {
    try {
      await recorder.stop();
      setVoiceUri(recorder.uri ?? null);
    } catch { /* ignore */ }
    setRecording(false);
  };

  // ── Speak-to-type transcription (full in app build; guarded in Expo Go) ──
  const startSpeech = async () => {
    if (isExpoGo) {
      Alert.alert('Voice typing', 'Speak-to-type works in the installed app. For now you can type, or record a voice note.');
      return;
    }
    try {
      const mod: any = await import('expo-speech-recognition');
      const perm = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow microphone & speech recognition.'); return; }
      speechBase.current = description ? description.trim() + ' ' : '';
      speechSubs.current.push(mod.ExpoSpeechRecognitionModule.addListener('result', (e: any) => {
        const t = e?.results?.[0]?.transcript;
        if (t) setDescription((speechBase.current + t).trim());
      }));
      speechSubs.current.push(mod.ExpoSpeechRecognitionModule.addListener('end', () => setListening(false)));
      mod.ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: true });
      setListening(true);
    } catch { Alert.alert('Error', 'Voice typing is unavailable right now.'); }
  };

  const stopSpeech = async () => {
    try { const mod: any = await import('expo-speech-recognition'); mod.ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
    speechSubs.current.forEach((s) => s.remove?.());
    speechSubs.current = [];
    setListening(false);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow location access to set your address.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setCoords({ lat: latitude, lng: longitude });
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        const g = geo[0];
        if (g) {
          const parts = [g.name, g.street, g.city, g.region, g.postalCode].filter(Boolean);
          setAddress(parts.join(', '));
        }
      } catch { /* keep coords only */ }
    } catch {
      Alert.alert('Location error', 'Could not get your location. Enter address manually.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (!description.trim()) return Alert.alert('Required', 'Please describe the work needed.');
    if (!coords) return Alert.alert('Location needed', 'Tap "Use my current location" to set where the service is needed.');
    if (!address.trim()) return Alert.alert('Address needed', 'Please add an address.');

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('category', String(category));
      form.append('workDescription', description.trim());
      form.append('latitude', String(coords.lat));
      form.append('longitude', String(coords.lng));
      form.append('address', address.trim());
      form.append('timeSlot', slot);

      if (voiceUri) {
        const name = voiceUri.split('/').pop() || 'voice.m4a';
        // @ts-expect-error React Native FormData file shape
        form.append('voiceNote', { uri: voiceUri, name, type: 'audio/m4a' });
        form.append('voiceTranscript', description.trim());
        form.append('voiceLanguage', 'en-IN');
      }

      const res = await api.post('/booking', form);
      const booking = res.data.booking;
      Alert.alert('Booking created! 🎉', 'Workers near you will start sending bids.');
      if (booking?._id) {
        router.replace(`/booking/${booking._id}`);
      } else {
        router.replace('/(tabs)/bookings');
      }
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not create booking'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>Book {name || 'Service'}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Describe the work</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="e.g. Fan not working in bedroom, needs repair... (or use voice below)"
            placeholderTextColor={Brand.textLight}
            multiline
            value={description}
            onChangeText={setDescription}
          />

          {/* Speak to type */}
          <TouchableOpacity
            style={[styles.voiceBtn, listening && styles.voiceBtnActive]}
            onPress={listening ? stopSpeech : startSpeech}
            activeOpacity={0.85}
          >
            <Ionicons name={listening ? 'ellipse' : 'mic'} size={16} color={listening ? Brand.white : Brand.navy} />
            <Text style={[styles.voiceBtnText, listening && { color: Brand.white }]}>
              {listening ? 'Listening… tap to stop' : 'Speak to type'}
            </Text>
          </TouchableOpacity>

          {/* Voice note */}
          {recording ? (
            <TouchableOpacity style={[styles.recBtn, styles.recBtnActive]} onPress={stopRec} activeOpacity={0.85}>
              <View style={styles.recDot} />
              <Text style={styles.recTextActive}>Recording… tap to stop</Text>
            </TouchableOpacity>
          ) : voiceUri ? (
            <View style={styles.voiceAttached}>
              <Ionicons name="mic" size={16} color={Brand.success} />
              <Text style={styles.voiceAttachedText}>Voice note attached</Text>
              <TouchableOpacity onPress={() => setVoiceUri(null)}>
                <Ionicons name="close-circle" size={20} color={Brand.danger} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.recBtn} onPress={startRec} activeOpacity={0.85}>
              <Ionicons name="mic-circle" size={20} color={Brand.orange} />
              <Text style={styles.recText}>Record a voice note</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Location</Text>
          <TouchableOpacity style={styles.mapBtn} onPress={() => router.push('/location-picker')} activeOpacity={0.9}>
            <Ionicons name="map" size={18} color={Brand.white} />
            <Text style={styles.mapBtnText}>Choose on map / Search location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.locBtn} onPress={useMyLocation} disabled={locating}>
            {locating ? <ActivityIndicator color={Brand.navy} size="small" /> : <Ionicons name="locate" size={18} color={Brand.navy} />}
            <Text style={styles.locBtnText}>{coords ? 'Update to my current location' : 'Use my current location'}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Address (auto-filled, you can edit)"
            placeholderTextColor={Brand.textLight}
            value={address}
            onChangeText={setAddress}
          />
          {coords ? <Text style={styles.coordHint}>📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</Text> : null}

          <Text style={styles.label}>Preferred time</Text>
          <View style={styles.slotRow}>
            {SLOTS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.slot, slot === s.key && styles.slotActive]}
                onPress={() => setSlot(s.key)}
              >
                <Text style={[styles.slotText, slot === s.key && styles.slotTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting} activeOpacity={0.9}>
          {submitting ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.submitText}>Post Booking Request</Text>}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { backgroundColor: Brand.navy },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 30 },
  label: { fontSize: 12, fontWeight: '800', color: Brand.textMuted, marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Brand.text },
  textarea: { height: 110, textAlignVertical: 'top' },
  voiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.navy50, borderRadius: 12, paddingVertical: 12, marginTop: 10 },
  voiceBtnActive: { backgroundColor: Brand.navy },
  voiceBtnText: { color: Brand.navy, fontWeight: '800', fontSize: 13.5 },
  recBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.orange50, borderRadius: 12, paddingVertical: 12, marginTop: 10 },
  recBtnActive: { backgroundColor: '#fef2f2' },
  recDot: { height: 10, width: 10, borderRadius: 5, backgroundColor: Brand.danger },
  recText: { color: Brand.orangeDark, fontWeight: '800', fontSize: 13.5 },
  recTextActive: { color: Brand.danger, fontWeight: '800', fontSize: 13.5 },
  voiceAttached: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.successBg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 10 },
  voiceAttachedText: { flex: 1, color: Brand.success, fontWeight: '700', fontSize: 13.5 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.navy, borderRadius: 14, paddingVertical: 14, marginBottom: 10 },
  mapBtnText: { color: Brand.white, fontWeight: '800', fontSize: 14 },
  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.navy50, borderRadius: 14, paddingVertical: 14, marginBottom: 10 },
  locBtnText: { color: Brand.navy, fontWeight: '800', fontSize: 14 },
  coordHint: { fontSize: 12, color: Brand.textMuted, marginTop: 6 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { borderWidth: 1, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: Brand.card },
  slotActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  slotText: { fontSize: 13.5, fontWeight: '700', color: Brand.textMuted },
  slotTextActive: { color: Brand.white },
  footer: { backgroundColor: Brand.card, borderTopWidth: 1, borderTopColor: Brand.border, paddingHorizontal: 20, paddingTop: 12 },
  submitBtn: { backgroundColor: Brand.orange, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
});
