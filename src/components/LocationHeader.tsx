import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { appAlert } from '@/components/AppAlert';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import api, { getApiError } from '@/lib/api';
import { useCustomerLocation } from '@/lib/locationContext';
import { consumePickedLocation } from '@/lib/locationBridge';
import { useTheme, type ThemeColors } from '@/lib/theme';

interface Availability { available: boolean; workerCount: number }

interface BookingLike { status?: string }

const ACTIVE_STATUSES = [
  'finding_workers',
  'bids_received',
  'worker_accepted',
  'worker_approved',
  'payment_done',
  'in_progress',
];

export default function LocationHeader() {
  const router = useRouter();
  const { location, setLocation } = useCustomerLocation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
        const active = (r.data.bookings || []).some((b: BookingLike) =>
          ACTIVE_STATUSES.includes(String(b.status))
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
      appAlert('Failed', getApiError(e, 'Could not add you to the waitlist'));
    } finally {
      setJoining(false);
    }
  };

  const unavailable = avail && !avail.available && !checking;

  return (
    <View>
      {/* Compact inline row — the address reads as part of the page, not a card. */}
      <TouchableOpacity
        style={[styles.row, hasActiveBooking && styles.rowLocked]}
        activeOpacity={hasActiveBooking ? 1 : 0.7}
        onPress={() => { if (!hasActiveBooking) router.push('/location-picker'); }}
      >
        <Ionicons name="location" size={17} color={hasActiveBooking ? colors.textLight : colors.textMuted} />
        <Text style={styles.rowText} numberOfLines={1}>
          Your Location{' '}
          <Text style={styles.rowAddress}>— {location?.address || 'Set your location'}</Text>
          {checking ? <Text style={styles.rowHint}> · checking…</Text> : null}
        </Text>
        {hasActiveBooking ? (
          <Ionicons name="lock-closed" size={14} color={colors.textLight} />
        ) : (
          <Ionicons name="chevron-down" size={17} color={colors.textMuted} />
        )}
      </TouchableOpacity>

      {hasActiveBooking && (
        <View style={styles.lockedNotice}>
          <Ionicons name="information-circle" size={14} color={colors.amber} />
          <Text style={styles.lockedText}>Location locked while you have an active booking.</Text>
        </View>
      )}

      {unavailable && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="sad-outline" size={20} color={colors.danger} />
            <Text style={styles.cardTitle}>Sorry, we&apos;re not available here yet</Text>
          </View>
          <Text style={styles.cardMsg}>
            No workers are available to provide service at this location right now. We promise Fixo will reach this place very soon! 🤝
          </Text>
          {waitlistDone ? (
            <View style={styles.doneRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.doneText}>You&apos;re on the waitlist — we&apos;ll notify you the moment we arrive.</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.waitBtn} onPress={joinWaitlist} disabled={joining} activeOpacity={0.9}>
              {joining ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <>
                  <Ionicons name="notifications-outline" size={16} color={colors.onAccent} />
                  <Text style={styles.waitT}>Notify me when available</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    rowLocked: { opacity: 0.7 },
    rowText: { flex: 1, fontSize: 13, fontWeight: '500', color: c.textMuted },
    rowAddress: { fontWeight: '800', color: c.text },
    rowHint: { color: c.textLight },
    lockedNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    lockedText: { fontSize: 11, color: c.amber, fontWeight: '600' },
    card: { backgroundColor: c.dangerBg, borderRadius: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.danger, marginTop: 10 },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { flex: 1, fontSize: 14.5, fontWeight: '800', color: c.danger },
    cardMsg: { fontSize: 12.5, color: c.danger, marginTop: 6, lineHeight: 18 },
    waitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.orange, borderRadius: 12, paddingVertical: 12, marginTop: 12 },
    waitT: { color: c.onAccent, fontSize: 13.5, fontWeight: '800' },
    doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: c.successBg, borderRadius: 10, padding: 10 },
    doneText: { flex: 1, fontSize: 12.5, color: c.success, fontWeight: '600' },
  });
