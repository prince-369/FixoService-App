import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Coords { lat: number; lng: number; }

interface Props {
  customer: Coords;
  worker?: Coords | null;
}

const html = (clat: number, clng: number) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
</head><body><div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${clat}, ${clng}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  function dot(color){ return L.divIcon({className:'',html:'<div style="width:18px;height:18px;border-radius:50%;background:'+color+';border:3px solid #fff;box-shadow:0 0 0 2px '+color+'"></div>',iconSize:[18,18],iconAnchor:[9,9]}); }
  var customer = L.marker([${clat}, ${clng}], {icon:dot('#2563eb')}).addTo(map);
  var worker = null;
  function setWorker(la, ln){
    if(!worker){ worker = L.marker([la,ln],{icon:dot('#10b981')}).addTo(map); }
    else { worker.setLatLng([la,ln]); }
    try { map.fitBounds(L.latLngBounds([[${clat},${clng}],[la,ln]]).pad(0.4)); } catch(e){}
  }
</script></body></html>`;

export default function TrackingMap({ customer, worker }: Props) {
  const ref = useRef<WebView>(null);

  // Push worker location into the map whenever it changes.
  useEffect(() => {
    if (worker) ref.current?.injectJavaScript(`setWorker(${worker.lat}, ${worker.lng}); true;`);
  }, [worker]);

  return (
    <View style={styles.wrap}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html: html(customer.lat, customer.lng) }}
        onLoadEnd={() => {
          if (worker) ref.current?.injectJavaScript(`setWorker(${worker.lat}, ${worker.lng}); true;`);
        }}
        scrollEnabled={false}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 200, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e8eaf0' },
});
