import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ThemeColors } from '@/lib/theme';


const PAGES: Record<string, { title: string; url: string }> = {
  privacy: { title: 'Privacy Policy', url: 'https://fixoservice.vercel.app/privacy-policy' },
  terms: { title: 'Terms of Service', url: 'https://fixoservice.vercel.app/terms' },
  refund: { title: 'Refund Policy', url: 'https://fixoservice.vercel.app/refund-policy' },
  about: { title: 'About Fixo', url: 'https://fixoservice.vercel.app' },
};

export default function LegalScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const page = PAGES[type || 'privacy'] || PAGES.privacy;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{page.title}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <WebView
        source={{ uri: page.url }}
        startInLoadingState
        renderLoading={() => <ActivityIndicator color={colors.orange} style={styles.loader} />}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  topbar: { backgroundColor: c.navy },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: c.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  loader: { position: 'absolute', top: '50%', left: 0, right: 0 },
});
