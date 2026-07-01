import { useCallback, useEffect, useRef, useState } from 'react';
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
import { getSocket, connectSocket } from '@/lib/socket';
import { useAppSelector } from '@/store/hooks';

type AvailabilitySummary = { total: number; active: number; inactive: number; radiusMeters: number };

// expo-speech-recognition is a native module (not in Expo Go) — only load it in a real build.
const isExpoGo =
  Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

const pad = (n: number) => String(n).padStart(2, '0');

// Next 6 days as selectable chips (dependency-free scheduler).
const buildDateOptions = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, label, date: d };
  });
};

// 6:00 AM → 10:00 PM at 30-minute steps.
const buildTimeOptions = () => {
  const out: string[] = [];
  for (let h = 6; h <= 22; h++) { out.push(`${pad(h)}:00`); if (h !== 22) out.push(`${pad(h)}:30`); }
  return out;
};

const formatTimeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${pad(m)} ${ampm}`;
};

// Pick a friendly icon based on the category name.
const categoryIcon = (name?: string): keyof typeof Ionicons.glyphMap => {
  const n = (name || '').toLowerCase();
  if (n.includes('electric') || n.includes('light') || n.includes('fan')) return 'flash';
  if (n.includes('plumb') || n.includes('water') || n.includes('tap')) return 'water';
  if (n.includes('clean')) return 'sparkles';
  if (n.includes('paint')) return 'color-palette';
  if (n.includes('carpen') || n.includes('wood') || n.includes('furniture')) return 'hammer';
  if (n.includes('ac') || n.includes('cool') || n.includes('fridge') || n.includes('appliance')) return 'snow';
  return 'construct';
};

export default function NewBookingScreen() {
  const { category, name } = useLocalSearchParams<{ category: string; name?: string }>();
  const router = useRouter();

  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [scheduleMode, setScheduleMode] = useState<'asap' | 'scheduled'>('asap');
  const [schedDateKey, setSchedDateKey] = useState<string>('');
  const [schedTime, setSchedTime] = useState<string>('');
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Real-time worker availability around the chosen location.
  const { user } = useAppSelector((s) => s.auth);
  const [availability, setAvailability] = useState<AvailabilitySummary | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);

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

  // Fetch live worker availability for the chosen category + location (10 km).
  const loadAvailability = useCallback(async (silent = false) => {
    if (!category || !coords) { setAvailability(null); setLoadingAvail(false); return; }
    if (!silent) setLoadingAvail(true);
    try {
      const { data } = await api.get('/booking/workers/availability-summary', {
        params: { category, latitude: coords.lat, longitude: coords.lng },
      });
      setAvailability(data.summary || null);
    } catch {
      if (!silent) setAvailability(null);
    } finally {
      if (!silent) setLoadingAvail(false);
    }
  }, [category, coords]);

  // Refetch when category or location changes (debounced).
  useEffect(() => {
    if (!category || !coords) { setAvailability(null); return; }
    setWaitlistJoined(false);
    const t = setTimeout(() => { void loadAvailability(false); }, 400);
    return () => clearTimeout(t);
  }, [category, coords, loadAvailability]);

  // Live updates: silently refresh counts when a worker goes online/offline.
  useEffect(() => {
    if (!user?._id || !category || !coords) return;
    connectSocket(user._id);
    const socket = getSocket();
    if (!socket) return;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => { clearTimeout(debounce); debounce = setTimeout(() => { void loadAvailability(true); }, 800); };
    socket.on('workers:availability-changed', onChange);
    return () => { clearTimeout(debounce); socket.off('workers:availability-changed', onChange); };
  }, [user?._id, category, coords, loadAvailability]);

  // No workers nearby yet → let the customer ask Fixo to expand here (admin gets notified).
  const handleJoinWaitlist = async () => {
    if (!coords) return;
    setJoiningWaitlist(true);
    try {
      await api.post('/customer/waitlist', { latitude: coords.lat, longitude: coords.lng, address: address.trim() });
      setWaitlistJoined(true);
      Alert.alert('Thanks!', "We'll notify you the moment Fixo arrives in your area.");
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not submit right now. Please try again.'));
    } finally {
      setJoiningWaitlist(false);
    }
  };

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

  // Scheduling chips (no native date-picker dependency).
  const dateOptions = buildDateOptions();
  const timeOptions = buildTimeOptions();
  const buildScheduledDate = (): Date | null => {
    if (!schedDateKey || !schedTime) return null;
    const opt = dateOptions.find((d) => d.key === schedDateKey);
    if (!opt) return null;
    const [h, m] = schedTime.split(':').map(Number);
    const d = new Date(opt.date);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const submit = async () => {
    if (!description.trim()) return Alert.alert('Required', 'Please describe the work needed.');
    if (!coords) return Alert.alert('Location needed', 'Tap "Use my current location" to set where the service is needed.');
    if (!address.trim()) return Alert.alert('Address needed', 'Please add an address.');

    let scheduledISO: string | undefined;
    if (scheduleMode === 'scheduled') {
      const sd = buildScheduledDate();
      if (!sd) return Alert.alert('Pick a time', 'Please choose the date and time you want the work done.');
      if (sd.getTime() < Date.now() + 5 * 60 * 1000) return Alert.alert('Invalid time', 'Please choose a time at least 5 minutes from now.');
      scheduledISO = sd.toISOString();
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('category', String(category));
      form.append('workDescription', description.trim());
      form.append('latitude', String(coords.lat));
      form.append('longitude', String(coords.lng));
      form.append('address', address.trim());
      if (scheduledISO) form.append('scheduledAt', scheduledISO);

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
          <Text style={styles.topTitle} numberOfLines={1}>New Booking</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Friendly category banner */}
        <View style={styles.catBanner}>
          <View style={styles.catIcon}>
            <Ionicons name={categoryIcon(name)} size={24} color={Brand.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.catLabel}>You&apos;re booking</Text>
            <Text style={styles.catName} numberOfLines={1}>{name || 'Service'}</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Describe the work */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="document-text-outline" size={18} color={Brand.navy} />
              <Text style={styles.cardTitle}>Describe the work</Text>
            </View>
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
          </View>

          {/* Location */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="location-outline" size={18} color={Brand.navy} />
              <Text style={styles.cardTitle}>Where do you need it?</Text>
            </View>
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
            {coords ? (
              <View style={styles.coordRow}>
                <Ionicons name="pin" size={13} color={Brand.success} />
                <Text style={styles.coordHint}>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</Text>
              </View>
            ) : null}

            {/* Live worker availability around this location */}
            {coords && category ? (
              <View style={styles.availBox}>
                <View style={styles.availHead}>
                  <Ionicons name="people" size={14} color={Brand.navy} />
                  <Text style={styles.availTitle}>Worker availability around this location</Text>
                </View>

                {loadingAvail && !availability ? (
                  <Text style={styles.availLoading}>Checking nearby workers…</Text>
                ) : availability && availability.total > 0 ? (
                  <>
                    <View style={styles.availChips}>
                      <View style={[styles.chip, styles.chipTotal]}><Text style={styles.chipTotalText}>Total: {availability.total}</Text></View>
                      <View style={[styles.chip, styles.chipActive]}><Text style={styles.chipActiveText}>● Active: {availability.active}</Text></View>
                      <View style={[styles.chip, styles.chipInactive]}><Text style={styles.chipInactiveText}>Inactive: {availability.inactive}</Text></View>
                    </View>
                    <Text style={styles.availHint}>
                      Live counts within ~{Math.round(availability.radiusMeters / 1000)} km. Updates automatically as workers go online/offline.
                    </Text>
                  </>
                ) : availability && availability.total === 0 ? (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.availEmptyTitle}>Fixo isn&apos;t available here yet — but we&apos;re coming soon!</Text>
                    <Text style={styles.availHint}>Tell us you want Fixo here and we&apos;ll notify you the moment workers are available near you.</Text>
                    {waitlistJoined ? (
                      <View style={styles.waitlistDone}>
                        <Ionicons name="checkmark-circle" size={15} color={Brand.success} />
                        <Text style={styles.waitlistDoneText}>You&apos;re on the list — we&apos;ll reach out when Fixo arrives here.</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={[styles.waitlistBtn, joiningWaitlist && { opacity: 0.6 }]} onPress={handleJoinWaitlist} disabled={joiningWaitlist} activeOpacity={0.9}>
                        {joiningWaitlist ? <ActivityIndicator color={Brand.white} size="small" /> : <Ionicons name="notifications" size={15} color={Brand.white} />}
                        <Text style={styles.waitlistBtnText}>Notify me when Fixo arrives</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* When do you need it? */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="calendar-outline" size={18} color={Brand.navy} />
              <Text style={styles.cardTitle}>When do you need it?</Text>
            </View>

            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, scheduleMode === 'asap' && styles.modeBtnOn]}
                onPress={() => setScheduleMode('asap')}
                activeOpacity={0.85}
              >
                <Text style={[styles.modeText, scheduleMode === 'asap' && styles.modeTextOn]}>As soon as possible</Text>
                <Text style={[styles.modeHint, scheduleMode === 'asap' && styles.modeHintOn]}>Worker starts right away</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, scheduleMode === 'scheduled' && styles.modeBtnOn]}
                onPress={() => setScheduleMode('scheduled')}
                activeOpacity={0.85}
              >
                <Text style={[styles.modeText, scheduleMode === 'scheduled' && styles.modeTextOn]}>Pick a time</Text>
                <Text style={[styles.modeHint, scheduleMode === 'scheduled' && styles.modeHintOn]}>Choose your own time</Text>
              </TouchableOpacity>
            </View>

            {scheduleMode === 'scheduled' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.schedLabel}>Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {dateOptions.map((d) => {
                    const on = schedDateKey === d.key;
                    return (
                      <TouchableOpacity key={d.key} style={[styles.dchip, on && styles.dchipOn]} onPress={() => setSchedDateKey(d.key)} activeOpacity={0.85}>
                        <Text style={[styles.dchipText, on && styles.dchipTextOn]}>{d.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.schedLabel, { marginTop: 12 }]}>Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {timeOptions
                    .filter((t) => {
                      if (schedDateKey !== dateOptions[0]?.key) return true;
                      const [h, m] = t.split(':').map(Number);
                      const cand = new Date(); cand.setHours(h, m, 0, 0);
                      return cand.getTime() >= Date.now() + 5 * 60 * 1000;
                    })
                    .map((t) => {
                      const on = schedTime === t;
                      return (
                        <TouchableOpacity key={t} style={[styles.dchip, on && styles.dchipOn]} onPress={() => setSchedTime(t)} activeOpacity={0.85}>
                          <Text style={[styles.dchipText, on && styles.dchipTextOn]}>{formatTimeLabel(t)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>

                <Text style={styles.schedNote}>
                  Workers can bid and lock the deal now, but the worker can only start at your chosen time. Both of you get notified when the time arrives. You can cancel anytime before then.
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting} activeOpacity={0.9}>
          {submitting ? <ActivityIndicator color={Brand.white} /> : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={Brand.white} />
              <Text style={styles.submitText}>Create Booking</Text>
            </>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { backgroundColor: Brand.navy, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, paddingBottom: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  catBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 16, padding: 12 },
  catIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' },
  catLabel: { color: '#cfd8ee', fontSize: 12 },
  catName: { color: Brand.white, fontSize: 18, fontWeight: '800', marginTop: 1 },
  scroll: { padding: 16, paddingBottom: 30, gap: 14 },
  card: { backgroundColor: Brand.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Brand.border, shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15.5, fontWeight: '800', color: Brand.text },
  input: { backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Brand.text },
  textarea: { height: 110, textAlignVertical: 'top' },
  voiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.navy50, borderRadius: 14, paddingVertical: 13, marginTop: 10 },
  voiceBtnActive: { backgroundColor: Brand.navy },
  voiceBtnText: { color: Brand.navy, fontWeight: '800', fontSize: 13.5 },
  recBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.orange50, borderRadius: 14, paddingVertical: 13, marginTop: 10 },
  recBtnActive: { backgroundColor: '#fef2f2' },
  recDot: { height: 10, width: 10, borderRadius: 5, backgroundColor: Brand.danger },
  recText: { color: Brand.orangeDark, fontWeight: '800', fontSize: 13.5 },
  recTextActive: { color: Brand.danger, fontWeight: '800', fontSize: 13.5 },
  voiceAttached: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.successBg, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, marginTop: 10 },
  voiceAttachedText: { flex: 1, color: Brand.success, fontWeight: '700', fontSize: 13.5 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.navy, borderRadius: 14, paddingVertical: 14, marginBottom: 10 },
  mapBtnText: { color: Brand.white, fontWeight: '800', fontSize: 14 },
  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.navy50, borderRadius: 14, paddingVertical: 14, marginBottom: 10 },
  locBtnText: { color: Brand.navy, fontWeight: '800', fontSize: 14 },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  coordHint: { fontSize: 12, color: Brand.textMuted, fontWeight: '600' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: Brand.bg, alignItems: 'center' },
  modeBtnOn: { borderColor: Brand.orange, backgroundColor: '#fff7ed' },
  modeText: { fontSize: 13.5, fontWeight: '800', color: Brand.text },
  modeTextOn: { color: Brand.orange },
  modeHint: { fontSize: 10.5, color: Brand.textMuted, marginTop: 2, textAlign: 'center' },
  modeHintOn: { color: '#c2410c' },
  schedLabel: { fontSize: 11, fontWeight: '800', color: Brand.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 },
  chipScroll: { gap: 8, paddingRight: 8 },
  dchip: { borderWidth: 1, borderColor: Brand.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Brand.bg },
  dchipOn: { borderColor: Brand.navy, backgroundColor: Brand.navy },
  dchipText: { fontSize: 12.5, fontWeight: '700', color: Brand.text },
  dchipTextOn: { color: Brand.white },
  schedNote: { fontSize: 11, color: Brand.textMuted, lineHeight: 16, marginTop: 12 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Brand.bg },
  availBox: { marginTop: 12, backgroundColor: '#eef4ff', borderWidth: 1, borderColor: '#d6e4ff', borderRadius: 14, padding: 12 },
  availHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  availTitle: { fontSize: 11.5, fontWeight: '800', color: Brand.navy, textTransform: 'uppercase', letterSpacing: 0.3, flex: 1 },
  availLoading: { marginTop: 8, fontSize: 13, color: Brand.navy },
  availChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  chipTotal: { backgroundColor: Brand.white },
  chipTotalText: { fontSize: 12, fontWeight: '800', color: Brand.navy },
  chipActive: { backgroundColor: '#d1fae5' },
  chipActiveText: { fontSize: 12, fontWeight: '800', color: '#047857' },
  chipInactive: { backgroundColor: '#ffedd5' },
  chipInactiveText: { fontSize: 12, fontWeight: '800', color: '#c2410c' },
  availHint: { marginTop: 8, fontSize: 11, color: '#3b5bdb', lineHeight: 15 },
  availEmptyTitle: { fontSize: 13.5, fontWeight: '800', color: '#b45309' },
  waitlistBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.navy, borderRadius: 12, paddingVertical: 12, marginTop: 2 },
  waitlistBtnText: { color: Brand.white, fontSize: 13.5, fontWeight: '800' },
  waitlistDone: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#d1fae5', borderRadius: 10, padding: 10 },
  waitlistDoneText: { flex: 1, fontSize: 11.5, fontWeight: '700', color: '#047857' },
  slotActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  slotText: { fontSize: 13.5, fontWeight: '700', color: Brand.textMuted },
  slotTextActive: { color: Brand.white },
  footer: { backgroundColor: Brand.card, borderTopWidth: 1, borderTopColor: Brand.border, paddingHorizontal: 20, paddingTop: 12 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.orange, borderRadius: 16, paddingVertical: 16 },
  submitText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
});
