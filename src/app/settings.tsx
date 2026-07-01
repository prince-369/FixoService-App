import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

import { Brand } from '@/lib/config';

type PermResult = { granted: boolean; canAskAgain?: boolean };

// Detect Expo Go. expo-notifications CANNOT be loaded in Expo Go (push was
// removed in SDK 53+ and the module throws on import). So we skip it entirely
// there and only use it in a development/production build.
const isExpoGo =
  Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

const notifGet = async (): Promise<PermResult> => {
  if (isExpoGo) return { granted: false, canAskAgain: false };
  try {
    const mod = await import('expo-notifications');
    const r = await mod.getPermissionsAsync();
    return { granted: r.granted, canAskAgain: r.canAskAgain };
  } catch { return { granted: false }; }
};
const notifRequest = async (): Promise<PermResult> => {
  if (isExpoGo) return { granted: false, canAskAgain: false };
  try {
    const mod = await import('expo-notifications');
    const r = await mod.requestPermissionsAsync();
    return { granted: r.granted, canAskAgain: r.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
};

const micGet = async (): Promise<PermResult> => {
  try {
    const mod = await import('expo-audio');
    const r = await (mod as any).AudioModule.getRecordingPermissionsAsync();
    return { granted: r.granted, canAskAgain: r.canAskAgain };
  } catch { return { granted: false }; }
};
const micRequest = async (): Promise<PermResult> => {
  try {
    const mod = await import('expo-audio');
    const r = await (mod as any).AudioModule.requestRecordingPermissionsAsync();
    return { granted: r.granted, canAskAgain: r.canAskAgain };
  } catch { return { granted: false }; }
};

interface PermDef {
  key: string;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  get: () => Promise<PermResult>;
  request: () => Promise<PermResult>;
}

const PERMISSIONS: PermDef[] = [
  { key: 'location', label: 'Location', desc: 'Find nearby workers & set service address', icon: 'location',
    get: () => Location.getForegroundPermissionsAsync(), request: () => Location.requestForegroundPermissionsAsync() },
  { key: 'notifications', label: 'Notifications', desc: 'Booking, bids and reward updates', icon: 'notifications',
    get: notifGet, request: notifRequest },
  { key: 'camera', label: 'Camera', desc: 'Take a profile photo', icon: 'camera',
    get: () => ImagePicker.getCameraPermissionsAsync(), request: () => ImagePicker.requestCameraPermissionsAsync() },
  { key: 'photos', label: 'Photos / Gallery', desc: 'Upload images from your gallery', icon: 'images',
    get: () => ImagePicker.getMediaLibraryPermissionsAsync(), request: () => ImagePicker.requestMediaLibraryPermissionsAsync() },
  { key: 'microphone', label: 'Microphone', desc: 'Record voice notes for bookings', icon: 'mic',
    get: micGet, request: micRequest },
];

export default function SettingsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next: Record<string, boolean> = {};
    await Promise.all(PERMISSIONS.map(async (p) => {
      try { next[p.key] = (await p.get()).granted; } catch { next[p.key] = false; }
    }));
    setStatus(next);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (p: PermDef, on: boolean) => {
    if (on) {
      const res = await p.request();
      if (res.granted) {
        setStatus((s) => ({ ...s, [p.key]: true }));
      } else if (res.canAskAgain === false) {
        Alert.alert('Permission blocked', `Please enable ${p.label} from your phone Settings.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
      }
    } else {
      // Permissions can only be revoked from system settings.
      Alert.alert('Manage permission', `To turn off ${p.label}, disable it in your phone Settings.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const appVersion = Constants.expoConfig?.version || (Constants as any).manifest?.version || '1.0.0';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>App Permissions</Text>
        <View style={styles.card}>
          {PERMISSIONS.map((p, i) => (
            <View key={p.key}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.row}>
                <View style={styles.iconWrap}><Ionicons name={p.icon} size={19} color={Brand.navy} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{p.label}</Text>
                  <Text style={styles.rowDesc}>{p.desc}</Text>
                </View>
                <Switch
                  value={!!status[p.key]}
                  onValueChange={(v) => toggle(p, v)}
                  trackColor={{ false: '#d1d5db', true: Brand.orange }}
                  thumbColor={Brand.white}
                  disabled={loading}
                />
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Permissions are managed by your phone. Turning a permission off opens your system settings.
        </Text>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}><Ionicons name="information-circle" size={19} color={Brand.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>App Version</Text>
              <Text style={styles.rowDesc}>You&apos;re on the latest experience</Text>
            </View>
            <Text style={styles.versionText}>{appVersion}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/change-password')} activeOpacity={0.7}>
            <View style={styles.iconWrap}><Ionicons name="key" size={19} color={Brand.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Change Password</Text>
              <Text style={styles.rowDesc}>Update your account password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Brand.textLight} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => router.push('/help')} activeOpacity={0.7}>
            <View style={styles.iconWrap}><Ionicons name="help-circle" size={19} color={Brand.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Help & Support</Text>
              <Text style={styles.rowDesc}>FAQs, raise tickets, contact us</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Brand.textLight} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Language</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}><Ionicons name="globe" size={19} color={Brand.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>English</Text>
              <Text style={styles.rowDesc}>Currently active</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={Brand.success} />
          </View>
          {['हिंदी (Hindi)', 'বাংলা (Bengali)', 'తెలుగు (Telugu)', 'मराठी (Marathi)', 'தமிழ் (Tamil)', 'ગુજરાતી (Gujarati)', 'ಕನ್ನಡ (Kannada)', 'മലയാളം (Malayalam)', 'ਪੰਜਾਬੀ (Punjabi)', 'ଓଡ଼ିଆ (Odia)', 'اردو (Urdu)'].map((lang) => (
            <View key={lang}>
              <View style={styles.divider} />
              <View style={[styles.row, { opacity: 0.45 }]}>
                <View style={styles.iconWrap}><Ionicons name="globe-outline" size={19} color={Brand.textLight} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{lang}</Text>
                  <Text style={[styles.rowDesc, { color: Brand.orange }]}>Coming soon</Text>
                </View>
                <Ionicons name="lock-closed" size={14} color={Brand.textLight} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
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
  scroll: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: Brand.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 22, marginLeft: 4 },
  card: { backgroundColor: Brand.card, borderRadius: 18, borderWidth: 1, borderColor: Brand.border, overflow: 'hidden', shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  iconWrap: { height: 40, width: 40, borderRadius: 12, backgroundColor: Brand.navy50, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '700', color: Brand.text },
  rowDesc: { fontSize: 12, color: Brand.textMuted, marginTop: 1 },
  versionText: { fontSize: 13, fontWeight: '800', color: Brand.textMuted },
  divider: { height: 1, backgroundColor: Brand.border, marginLeft: 70 },
  note: { fontSize: 12, color: Brand.textLight, marginTop: 14, lineHeight: 17, paddingHorizontal: 4 },
});
