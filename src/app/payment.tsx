import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
        <ActivityIndicator color={Brand.orange} size="large" />
        <Text style={styles.verifyText}>Confirming your payment...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
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
        startInLoadingState
        renderLoading={() => <ActivityIndicator color={Brand.orange} style={styles.loader} size="large" />}
        style={{ flex: 1, backgroundColor: Brand.navy }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.bg, gap: 16 },
  verifyText: { fontSize: 15, color: Brand.textMuted, fontWeight: '600' },
  loader: { position: 'absolute', top: '50%', left: 0, right: 0 },
});
