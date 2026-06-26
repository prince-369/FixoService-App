import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

import api, { getApiError } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { Brand, RAZORPAY_KEY } from '@/lib/config';

const checkoutHtml = (opts: {
  key: string; amount: number; orderId: string; name: string; phone: string; email: string;
}) => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{margin:0;background:#0f1c3f;font-family:sans-serif;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh}</style>
</head><body>
<div>Opening secure payment...</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  var options = {
    key: '${opts.key}',
    amount: ${opts.amount},
    currency: 'INR',
    order_id: '${opts.orderId}',
    name: 'Fixo',
    description: 'Service Booking Payment',
    prefill: { name: ${JSON.stringify(opts.name)}, contact: ${JSON.stringify(opts.phone)}, email: ${JSON.stringify(opts.email)} },
    theme: { color: '#f97316' },
    handler: function (response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'success',
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature }));
    },
    modal: { ondismiss: function () { window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'dismiss' })); } }
  };
  try { var rzp = new Razorpay(options); rzp.open(); }
  catch (e) { window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'error' })); }
</script></body></html>`;

export default function PaymentScreen() {
  const { bookingId, orderId, amount } = useLocalSearchParams<{ bookingId: string; orderId: string; amount: string }>();
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const [verifying, setVerifying] = useState(false);
  const [launching, setLaunching] = useState(true);

  // Razorpay amount comes through in paise — show a friendly rupee figure.
  const displayAmount = `₹${((Number(amount) || 0) / 100).toLocaleString('en-IN')}`;

  const onMessage = async (e: { nativeEvent: { data: string } }) => {
    let data: any;
    try { data = JSON.parse(e.nativeEvent.data); } catch { return; }

    if (data.event === 'dismiss') {
      router.back();
      return;
    }
    if (data.event === 'error') {
      Alert.alert('Payment error', 'Could not open payment. Please try again.');
      router.back();
      return;
    }
    if (data.event === 'success') {
      setVerifying(true);
      try {
        await api.post(`/booking/${bookingId}/payment/verify`, {
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_signature: data.razorpay_signature,
        });
        Alert.alert('Payment successful! 🎉', 'Your booking is confirmed.');
      } catch (err) {
        Alert.alert('Verification pending', getApiError(err, 'Payment received — confirming shortly.'));
      } finally {
        setVerifying(false);
        router.back();
      }
    }
  };

  if (verifying) {
    return (
      <View style={styles.center}>
        <View style={styles.verifyIcon}>
          <ActivityIndicator color={Brand.success} size="large" />
        </View>
        <Text style={styles.verifyTitle}>Confirming your payment</Text>
        <Text style={styles.verifyText}>Hang tight, this only takes a moment…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={22} color={Brand.white} />
        </View>
        <Text style={styles.headerLabel}>Amount to pay</Text>
        <Text style={styles.headerAmount}>{displayAmount}</Text>
        <View style={styles.secureRow}>
          <Ionicons name="shield-checkmark" size={14} color={Brand.success} />
          <Text style={styles.secureText}>Secured by Razorpay</Text>
        </View>
      </SafeAreaView>

      <View style={styles.webWrap}>
        {launching && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={Brand.orange} size="large" />
            <Text style={styles.loadingText}>Opening secure payment…</Text>
          </View>
        )}
        <WebView
          originWhitelist={['*']}
          source={{ html: checkoutHtml({
            key: RAZORPAY_KEY,
            amount: Number(amount) || 0,
            orderId: String(orderId),
            name: user?.fullName || '',
            phone: user?.phone || '',
            email: user?.email || '',
          }) }}
          onMessage={onMessage}
          onLoadEnd={() => setLaunching(false)}
          startInLoadingState
          style={{ flex: 1, backgroundColor: Brand.navy }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.navy },
  header: { backgroundColor: Brand.navy, alignItems: 'center', paddingBottom: 24, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  lockBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  headerLabel: { color: '#cfd8ee', fontSize: 13, marginTop: 14 },
  headerAmount: { color: Brand.success, fontSize: 38, fontWeight: '900', marginTop: 4 },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  secureText: { color: '#cfd8ee', fontSize: 12, fontWeight: '600' },
  webWrap: { flex: 1, backgroundColor: Brand.navy },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: Brand.navy, zIndex: 2 },
  loadingText: { color: '#cfd8ee', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.bg, gap: 10, paddingHorizontal: 40 },
  verifyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: Brand.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  verifyTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  verifyText: { fontSize: 14, color: Brand.textMuted, fontWeight: '500', textAlign: 'center' },
});
