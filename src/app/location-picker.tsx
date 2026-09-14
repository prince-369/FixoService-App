import { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { appAlert } from '@/components/AppAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { setPickedLocation, searchPlaces, reverseGeocode } from '@/lib/locationBridge';
import { useTheme, type ThemeColors } from '@/lib/theme';

const INIT = { lat: 26.8467, lng: 80.9462 }; // default: Lucknow — the only city Fixo serves
const LOCATE_TIMEOUT_MS = 8000;

// Never let a slow/stuck GPS fix hang the UI — resolve to null instead so the
// caller can fall back to a last-known fix or give up cleanly.
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

const mapHtml = (lat: number, lng: number) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
</head><body><div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:false}).setView([${lat}, ${lng}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var marker = L.marker([${lat}, ${lng}], {draggable:true}).addTo(map);
  function post(){ var p=marker.getLatLng(); window.ReactNativeWebView.postMessage(JSON.stringify({lat:p.lat,lng:p.lng})); }
  marker.on('dragend', post);
  map.on('click', function(e){ marker.setLatLng(e.latlng); post(); });
  function moveTo(la,ln){ map.setView([la,ln],16); marker.setLatLng([la,ln]); post(); }
  setTimeout(post, 400);
</script></body></html>`;

export default function LocationPickerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const webRef = useRef<WebView>(null);

  const [coords, setCoords] = useState(INIT);
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ lat: number; lng: number; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyAddr, setBusyAddr] = useState(false);
  const [locating, setLocating] = useState(false);
  const webReady = useRef(false);
  const pendingMove = useRef<{ lat: number; lng: number } | null>(null);

  // The map's own JS (moveTo) only exists once the WebView has finished
  // loading Leaflet — injecting before that silently does nothing, so queue
  // any move that arrives first (e.g. an instant last-known-position fix).
  const moveMapTo = (lat: number, lng: number) => {
    if (webReady.current) webRef.current?.injectJavaScript(`moveTo(${lat}, ${lng}); true;`);
    else pendingMove.current = { lat, lng };
  };

  const onMapMessage = async (e: { nativeEvent: { data: string } }) => {
    try {
      const { lat, lng } = JSON.parse(e.nativeEvent.data);
      setCoords({ lat, lng });
      setBusyAddr(true);
      const addr = await reverseGeocode(lat, lng);
      if (addr) setAddress(addr);
      setBusyAddr(false);
    } catch { /* ignore */ }
  };

  const searchSeq = useRef(0);
  const doSearch = async (q: string) => {
    const seq = ++searchSeq.current;
    setSearching(true);
    const res = await searchPlaces(q);
    if (seq === searchSeq.current) setResults(res); // drop stale/out-of-order responses
    setSearching(false);
  };

  const runSearch = () => { if (query.trim()) doSearch(query.trim()); };

  // Live search-as-you-type, like Google's place search — no need to hit
  // enter/Go first. Debounced so it doesn't fire on every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(() => doSearch(q), 350);
    return () => clearTimeout(t);
  }, [query]);

  const pickResult = (r: { lat: number; lng: number; label: string }) => {
    setResults([]);
    setQuery('');
    setCoords({ lat: r.lat, lng: r.lng });
    setAddress(r.label);
    moveMapTo(r.lat, r.lng);
  };

  // silent=true is used for the automatic on-open attempt, so a denied
  // permission or a cold GPS doesn't pop an alert the user never asked for —
  // tapping the button explicitly still gets full feedback.
  const useCurrent = async (silent = false) => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!silent) appAlert('Permission needed', 'Please allow location access to use your current location.');
        return;
      }

      // Fast path: a recent cached fix moves the map immediately instead of
      // leaving it on the Lucknow default while a fresh GPS lock is acquired.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 }).catch(() => null);
      if (last) moveMapTo(last.coords.latitude, last.coords.longitude);

      // Refine with a fresh fix, but never hang the UI on a slow/stuck GPS —
      // fall back to the last-known fix (if any) once the timeout hits.
      const fresh = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        LOCATE_TIMEOUT_MS,
      );
      if (fresh) {
        moveMapTo(fresh.coords.latitude, fresh.coords.longitude);
      } else if (!last && !silent) {
        appAlert('Location timed out', 'Could not get your location in time. Please search or tap on the map instead.');
      }
    } catch {
      if (!silent) appAlert('Location error', 'Could not get your location. Please search or tap on the map instead.');
    } finally {
      setLocating(false);
    }
  };

  // Centre on the user automatically instead of always opening on the
  // hardcoded Lucknow default.
  useEffect(() => { useCurrent(true); }, []);

  const confirm = () => {
    setPickedLocation({ lat: coords.lat, lng: coords.lng, address: address || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` });
    router.back();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Choose Location</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search any area, landmark, city..."
            placeholderTextColor={colors.textLight}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />
          {/* `onWhite`, not `text` — this whole bar (searchWrap) is always white,
              and `text` turns near-white in dark mode. */}
          {searching ? <ActivityIndicator size="small" color={colors.onWhite} /> : query ? (
            <TouchableOpacity onPress={runSearch}><Text style={styles.goText}>Go</Text></TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>

      {results.length > 0 ? (
        <View style={styles.resultsBox}>
          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => pickResult(item)}>
                <Ionicons name="location-outline" size={16} color={colors.orange} />
                <Text style={styles.resultText} numberOfLines={2}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      <View style={styles.mapWrap}>
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: mapHtml(INIT.lat, INIT.lng) }}
          onMessage={onMapMessage}
          onLoadEnd={() => {
            webReady.current = true;
            if (pendingMove.current) {
              const { lat, lng } = pendingMove.current;
              pendingMove.current = null;
              webRef.current?.injectJavaScript(`moveTo(${lat}, ${lng}); true;`);
            }
          }}
          style={{ flex: 1 }}
        />
        <TouchableOpacity style={styles.currentBtn} onPress={() => useCurrent(false)} disabled={locating}>
          {/* `onWhite`, not `text` — `currentBtn` below is always a white circle. */}
          {locating ? <ActivityIndicator size="small" color={colors.onWhite} /> : <Ionicons name="locate" size={20} color={colors.onWhite} />}
        </TouchableOpacity>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.addrRow}>
          <Ionicons name="pin" size={18} color={colors.orange} />
          <Text style={styles.addrText} numberOfLines={2}>
            {busyAddr ? 'Getting address...' : (address || 'Tap on the map or search to set location')}
          </Text>
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={confirm} activeOpacity={0.9}>
          <Text style={styles.confirmText}>Confirm Location</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  topbar: { backgroundColor: c.navy, paddingBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: c.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.white, borderRadius: 12, marginHorizontal: 16, marginTop: 6, paddingHorizontal: 14 },
  // `c.onWhite`, not `c.text` — `searchWrap` above is always white, and `c.text`
  // turns near-white in dark mode: typed text and the "Go" label both vanished.
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14.5, color: c.onWhite },
  goText: { color: c.onWhite, fontWeight: '800', fontSize: 14 },
  resultsBox: { backgroundColor: c.card, maxHeight: 230, borderBottomWidth: 1, borderBottomColor: c.border },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.border },
  resultText: { flex: 1, fontSize: 13.5, color: c.text },
  mapWrap: { flex: 1 },
  currentBtn: {
    position: 'absolute', right: 16, bottom: 16, height: 48, width: 48, borderRadius: 24,
    backgroundColor: c.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
  footer: { backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 20, paddingTop: 14 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  addrText: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 18 },
  confirmBtn: { backgroundColor: c.orange, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  confirmText: { color: c.white, fontSize: 16, fontWeight: '800' },
});
