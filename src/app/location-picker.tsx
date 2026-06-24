import { useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { Brand } from '@/lib/config';
import { setPickedLocation, searchPlaces, reverseGeocode } from '@/lib/locationBridge';

const INIT = { lat: 28.6139, lng: 77.209 }; // default: Delhi

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
  const router = useRouter();
  const webRef = useRef<WebView>(null);

  const [coords, setCoords] = useState(INIT);
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ lat: number; lng: number; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyAddr, setBusyAddr] = useState(false);

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

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const res = await searchPlaces(query.trim());
    setResults(res);
    setSearching(false);
  };

  const pickResult = (r: { lat: number; lng: number; label: string }) => {
    setResults([]);
    setQuery('');
    setCoords({ lat: r.lat, lng: r.lng });
    setAddress(r.label);
    webRef.current?.injectJavaScript(`moveTo(${r.lat}, ${r.lng}); true;`);
  };

  const useCurrent = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      webRef.current?.injectJavaScript(`moveTo(${latitude}, ${longitude}); true;`);
    } catch { /* ignore */ }
  };

  const confirm = () => {
    setPickedLocation({ lat: coords.lat, lng: coords.lng, address: address || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` });
    router.back();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Choose Location</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Brand.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search any area, landmark, city..."
            placeholderTextColor={Brand.textLight}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" color={Brand.navy} /> : query ? (
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
                <Ionicons name="location-outline" size={16} color={Brand.orange} />
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
          style={{ flex: 1 }}
        />
        <TouchableOpacity style={styles.currentBtn} onPress={useCurrent}>
          <Ionicons name="locate" size={20} color={Brand.navy} />
        </TouchableOpacity>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.addrRow}>
          <Ionicons name="pin" size={18} color={Brand.orange} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { backgroundColor: Brand.navy, paddingBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Brand.white, borderRadius: 12, marginHorizontal: 16, marginTop: 6, paddingHorizontal: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14.5, color: Brand.text },
  goText: { color: Brand.navy, fontWeight: '800', fontSize: 14 },
  resultsBox: { backgroundColor: Brand.card, maxHeight: 230, borderBottomWidth: 1, borderBottomColor: Brand.border },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Brand.border },
  resultText: { flex: 1, fontSize: 13.5, color: Brand.text },
  mapWrap: { flex: 1 },
  currentBtn: {
    position: 'absolute', right: 16, bottom: 16, height: 48, width: 48, borderRadius: 24,
    backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
  footer: { backgroundColor: Brand.card, borderTopWidth: 1, borderTopColor: Brand.border, paddingHorizontal: 20, paddingTop: 14 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  addrText: { flex: 1, fontSize: 13, color: Brand.textMuted, lineHeight: 18 },
  confirmBtn: { backgroundColor: Brand.orange, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  confirmText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
});
