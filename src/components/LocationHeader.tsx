import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import api, { getApiError } from '@/lib/api';
import { useCustomerLocation } from '@/lib/locationContext';
import { consumePickedLocation } from '@/lib/locationBridge';
import { Brand } from '@/lib/config';

interface Availability { available: boolean; workerCount: number }

export default function LocationHeader() {
  const router = useRouter();
  const { location, setLocation } = useCustomerLocation();
  const [avail, setAvail] = useState<Availability | null>(null);
  const [checking, setChecking] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [joining, setJoining] = useState(false);
  const [hasActiveBooking, setHasActiveBooking] = useState(false);

  // Pick up a location chosen on the map screen when we come back to this screen.
  useFocusEffect(useCallback(() => {
    const picked = consumePickedLocation();
    if (picked) setLocation({ lat: picked.lat, lng: picked.lng, address: picked.address });
    // Check if customer has any active booking to lock location changes.
    api.get('/customer/bookings')
      .then((r) => {
        const active = (r.data.bookings || []).some((b: any) =>
          ['finding_workers', 'bids_received', 'worker_accepted', 'worker_approved', 'payment_done', 'in_progress'].includes(b.status)
        );
        setHasActiveBooking(active);
      })
      .catch(() => {});
  }, [setLocation]));

  // Re-check service availability whenever the location changes.
  useEffect(() => {
    if (!location) { setAvail(null); return; }
    setChecking(true);
    setWaitlistDone(false);
    api.get('/customer/service-availability', { params: { lat: location.lat, lng: location.lng } })
      .then((r) => setAvail(r.data))
      .catch(() => setAvail(null))
      .finally(() => setChecking(false));
  }, [location?.lat, location?.lng]);

  const joinWaitlist = async () => {
    if (!location) return;
    setJoining(true);
    try {
      await api.post('/customer/waitlist', { latitude: location.lat, longitude: location.lng, address: location.address });
      setWaitlistDone(true);
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not add you to the waitlist'));
    } finally {
      setJoining(false);
    }
  };

  const unavailable = avail && !avail.available && !checking;

  return (
    <View>
      <TouchableOpacity style={[styles.header, hasActiveBooking && styles.headerLocked]} activeOpacity={hasActiveBooking ? 1 : 0.8} onPress={() => { if (!hasActiveBooking) router.push('/location-picker'); }}>
        <View style={styles.pin}><Ionicons name="location" size={18} color={hasActiveBooking ? Brand.textLight : Brand.orange} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Service location {checking ? '· checking…' : ''}{hasActiveBooking ? ' · locked' : ''}</Text>
          <Text style={[styles.addr, hasActiveBooking && { color: Brand.textMuted }]} numberOfLines={1}>{location?.address || 'Set your location'}</Text>
        </View>
        {hasActiveBooking ? (
          <Ionicons name="lock-closed" size={14} color={Brand.textLight} />
        ) : (
          <Ionicons name="chevron-down" size={18} color={Brand.textMuted} />
        )}
      </TouchableOpacity>

      {hasActiveBooking && (
        <View style={styles.lockedNotice}>
          <Ionicons name="information-circle" size={14} color="#92400e" />
          <Text style={styles.lockedText}>Location locked while you have an active booking.</Text>
        </View>
      )}

      {unavailable && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="sad-outline" size={20} color={Brand.danger} />
            <Text style={styles.cardTitle}>Sorry, we&apos;re not available here yet</Text>
          </View>
          <Text style={styles.cardMsg}>
            No workers are available to provide service at this location right now. We promise Fixo will reach this place very soon! 🤝
          </Text>
          {waitlistDone ? (
            <View style={styles.doneRow}>
              <Ionicons name="checkmark-circle" size={16} color={Brand.success} />
              <Text style={styles.doneText}>You&apos;re on the waitlist — we&apos;ll notify you the moment we arrive.</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.waitBtn} onPress={joinWaitlist} disabled={joining} activeOpacity={0.9}>
              {joining ? <ActivityIndicator color={Brand.white} /> : <><Ionicons name="notifications-outline" size={16} color={Brand.white} /><Text style={styles.waitT}>Notify me when available</Text></>}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Brand.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Brand.border },
  headerLocked: { opacity: 0.7 },
  pin: { width: 34, height: 34, borderRadius: 10, backgroundColor: Brand.orange50, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10.5, fontWeight: '700', color: Brand.textLight, textTransform: 'uppercase', letterSpacing: 0.4 },
  addr: { fontSize: 14, fontWeight: '800', color: Brand.text, marginTop: 1 },
  lockedNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 4 },
  lockedText: { fontSize: 11, color: '#92400e', fontWeight: '600' },
  card: { backgroundColor: Brand.dangerBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#fecaca', marginTop: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14.5, fontWeight: '800', color: '#b91c1c' },
  cardMsg: { fontSize: 12.5, color: '#b91c1c', marginTop: 6, lineHeight: 18 },
  waitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.orange, borderRadius: 12, paddingVertical: 12, marginTop: 12 },
  waitT: { color: Brand.white, fontSize: 13.5, fontWeight: '800' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: Brand.successBg, borderRadius: 10, padding: 10 },
  doneText: { flex: 1, fontSize: 12.5, color: '#047857', fontWeight: '600' },
});
