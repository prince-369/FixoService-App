import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { appAlert } from '@/components/AppAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme, type ThemeColors } from '@/lib/theme';
import { LOGO } from '@/lib/assets';
import { Image } from 'expo-image';

/**
 * A proper About screen, replacing the one-line `Alert.alert` that used to sit
 * behind the Profile tab's "About Fixo" row. A native alert can't show the logo,
 * can't be themed, and had nothing in it beyond a single sentence and a version
 * number that would have gone stale the moment this screen shipped a build the
 * alert's hardcoded string didn't know about.
 *
 * Content here is deliberately drawn from what this app already says elsewhere
 * (the home screen's own highlights, the login screen's own tagline) rather than
 * invented fresh — an About screen is the wrong place to introduce a claim the
 * rest of the app doesn't already make.
 */

const HIGHLIGHTS: { icon: keyof typeof Ionicons.glyphMap; t: string; d: string }[] = [
  { icon: 'shield-checkmark', t: 'Verified professionals', d: 'Every worker is checked before they can accept a job.' },
  { icon: 'mic', t: 'Book by voice', d: 'Type it, speak it, or send a voice note — your choice.' },
  { icon: 'navigate', t: 'Live tracking', d: 'See your professional on the map as they head to you.' },
  { icon: 'cash', t: 'Pay after the work', d: 'Cash or online, settled only once the job is done.' },
];

export default function AboutScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const version = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.android?.versionCode;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>About Fixo</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
          <Text style={styles.tagline}>Trusted local professionals, on demand</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What is Fixo?</Text>
          <Text style={styles.body}>
            Fixo connects you with verified local professionals for home services — electricians,
            plumbers, carpenters, AC technicians and more. Describe what you need, get matched
            with a nearby professional, track them on their way, and pay only once the work is
            actually done.
          </Text>
        </View>

        <View style={styles.card}>
          {HIGHLIGHTS.map((h, i) => (
            <View key={h.t} style={[styles.hRow, i === HIGHLIGHTS.length - 1 && styles.hRowLast]}>
              <View style={styles.hIcon}>
                <Ionicons name={h.icon} size={18} color={colors.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hTitle}>{h.t}</Text>
                <Text style={styles.hDesc}>{h.d}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="information-circle" size={19} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>App Version</Text>
              <Text style={styles.rowDesc}>Fixo Service for customers</Text>
            </View>
            <Text style={styles.versionText}>v{version}{buildNumber ? ` (${buildNumber})` : ''}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/legal', params: { type: 'privacy' } })}
          >
            <View style={styles.iconWrap}><Ionicons name="shield-checkmark-outline" size={19} color={colors.text} /></View>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/legal', params: { type: 'terms' } })}
          >
            <View style={styles.iconWrap}><Ionicons name="document-text-outline" size={19} color={colors.text} /></View>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://fixoservice.vercel.app')}
          >
            <View style={styles.iconWrap}><Ionicons name="globe-outline" size={19} color={colors.text} /></View>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Visit our website</Text>
            <Ionicons name="open-outline" size={18} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© {new Date().getFullYear()} Fixo. Made in India.</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    topbar: { backgroundColor: c.navy },
    topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 16, paddingTop: 4 },
    back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
    topTitle: { flex: 1, color: c.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
    scroll: { padding: 16, paddingBottom: 40, gap: 14 },
    hero: { alignItems: 'center', paddingVertical: 8, gap: 10 },
    logo: { width: 140, height: 50 },
    tagline: { color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
    card: {
      backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border,
      overflow: 'hidden', padding: 18,
      shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
    },
    sectionTitle: { fontSize: 15.5, fontWeight: '800', color: c.text, marginBottom: 8 },
    body: { fontSize: 13.5, lineHeight: 20, color: c.textMuted },
    hRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    hRowLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 },
    hIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: c.orange50, alignItems: 'center', justifyContent: 'center' },
    hTitle: { fontSize: 14, fontWeight: '800', color: c.text },
    hDesc: { fontSize: 12.5, color: c.textMuted, marginTop: 2, lineHeight: 17 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 3, marginHorizontal: -18, paddingHorizontal: 18 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 14, marginHorizontal: -18 },
    iconWrap: { height: 40, width: 40, borderRadius: 12, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { fontSize: 15, fontWeight: '700', color: c.text },
    rowDesc: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    versionText: { fontSize: 13, fontWeight: '800', color: c.textMuted },
    footer: { textAlign: 'center', fontSize: 12, color: c.textLight, marginTop: 6 },
  });
