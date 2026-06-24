import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import { Brand } from '@/lib/config';

const PAGES: Record<string, { title: string; url: string }> = {
  privacy: { title: 'Privacy Policy', url: 'https://fixo-service.vercel.app/privacy-policy' },
  terms: { title: 'Terms of Service', url: 'https://fixo-service.vercel.app/terms' },
  refund: { title: 'Refund Policy', url: 'https://fixo-service.vercel.app/refund-policy' },
};

export default function LegalScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const page = PAGES[type || 'privacy'] || PAGES.privacy;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{page.title}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <WebView
        source={{ uri: page.url }}
        startInLoadingState
        renderLoading={() => <ActivityIndicator color={Brand.orange} style={styles.loader} />}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { backgroundColor: Brand.navy },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  loader: { position: 'absolute', top: '50%', left: 0, right: 0 },
});
