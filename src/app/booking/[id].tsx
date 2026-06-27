import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import api, { getApiError } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { connectSocket, getSocket } from '@/lib/socket';
import { Brand } from '@/lib/config';
import { formatCurrency, formatDateTime, statusOf } from '@/lib/format';
import TrackingMap from '@/components/TrackingMap';

interface Worker { _id: string; fullName: string; phone?: string; rating?: number | { average?: number; count?: number }; }

// Worker rating may be a number or { average, count } — normalise it.
const ratingValue = (r: Worker['rating']): number | null => {
  if (typeof r === 'number') return r;
  if (r && typeof r.average === 'number') return r.average;
  return null;
};
interface NegotiationEntry { by: 'customer' | 'worker'; amount: number; message?: string; }
interface Bid {
  _id: string;
  priceOffered: number;
  worker?: Worker | string;
  negotiationStatus?: string;
  negotiations?: NegotiationEntry[];
  agreedAmount?: number;
}
interface BookingDetail {
  _id: string;
  status: string;
  workDescription?: string;
  amount: number;
  paymentMethod?: string;
  paymentStatus?: string;
  completionPin?: string;
  completionRequestedByWorkerAt?: string | null;
  customerLocation?: { address?: string; coordinates?: number[] };
  assignedWorker?: Worker;
  review?: { rating: number; feedback?: string };
  scheduledAt?: string | null;
  createdAt: string;
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [workerBusy, setWorkerBusy] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [workerLoc, setWorkerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [negotiatingBidId, setNegotiatingBidId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [starRating, setStarRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    try {
      const [bRes, bidRes] = await Promise.all([
        api.get(`/customer/bookings/${id}`),
        api.get(`/booking/${id}/bids`).catch(() => ({ data: { bids: [] } })),
      ]);
      setBooking(bRes.data.booking);
      setWorkerBusy(Boolean(bRes.data.workerBusy));
      setBids(bidRes.data.bids || []);
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: refresh on any booking/bid event for this booking.
  useEffect(() => {
    if (!user?._id) return;
    connectSocket(user._id);
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => load();
    // Join this booking's room to receive the worker's live location.
    socket.emit('booking:join', { bookingId: id });
    const onWorkerLoc = (data: { bookingId: string; coordinates: number[] }) => {
      if (data?.bookingId !== id || !Array.isArray(data.coordinates)) return;
      // coordinates are [lng, lat]
      setWorkerLoc({ lat: data.coordinates[1], lng: data.coordinates[0] });
    };
    socket.on('booking:new-bid', refresh);
    socket.on('booking_status_updated', refresh);
    socket.on('booking_accepted', refresh);
    socket.on('booking:bid-negotiation', refresh);
    socket.on('booking_confirmed', refresh);
    socket.on('worker:location-changed', onWorkerLoc);
    return () => {
      socket.emit('booking:leave', { bookingId: id });
      socket.off('booking:new-bid', refresh);
      socket.off('booking_status_updated', refresh);
      socket.off('booking_accepted', refresh);
      socket.off('booking:bid-negotiation', refresh);
      socket.off('booking_confirmed', refresh);
      socket.off('worker:location-changed', onWorkerLoc);
    };
  }, [user?._id, load, id]);

  // Safety-net polling: while the job is still live (finding workers, bids,
  // on the way, in progress…) auto-refresh every few seconds so new bids and
  // status changes appear on their own — even if the realtime socket can't
  // connect on a flaky network. Sockets stay primary (instant); this is backup.
  useEffect(() => {
    const liveStatuses = [
      'finding_workers', 'bids_received', 'worker_accepted',
      'worker_approved', 'payment_done', 'in_progress',
    ];
    if (!booking || !liveStatuses.includes(booking.status)) return;
    const timer = setInterval(() => { load(); }, 4000);
    return () => clearInterval(timer);
  }, [booking?.status, load]);

  const acceptBid = async (bidId: string) => {
    setBusy(true);
    try {
      await api.post(`/booking/${id}/bids/${bidId}/accept`);
      Alert.alert('Bid accepted', 'The worker will confirm and head to your location.');
      load();
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not accept bid'));
    } finally { setBusy(false); }
  };

  const sendCounter = async (bidId: string) => {
    if (!counterAmount.trim() || Number(counterAmount) <= 0) { Alert.alert('Enter a valid amount'); return; }
    setBusy(true);
    try {
      await api.post(`/booking/${id}/bids/${bidId}/counter`, { amount: Number(counterAmount) });
      setNegotiatingBidId(null);
      setCounterAmount('');
      load();
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not send counter offer'));
    } finally { setBusy(false); }
  };

  const doCancel = async () => {
    if (!cancelReason.trim()) { Alert.alert('Reason required', 'Please tell us why you are cancelling.'); return; }
    setBusy(true);
    try {
      await api.post(`/customer/bookings/${id}/cancel`, { reason: cancelReason.trim() });
      setShowCancel(false);
      setCancelReason('');
      Alert.alert('Cancelled', 'Your booking has been cancelled.');
      load();
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not cancel booking'));
    } finally { setBusy(false); }
  };

  const submitReview = async () => {
    if (starRating < 1) { Alert.alert('Rate first', 'Please tap the stars to rate your worker.'); return; }
    setBusy(true);
    try {
      await api.post(`/customer/bookings/${id}/review`, { rating: starRating, feedback: feedback.trim() });
      Alert.alert('Thank you! 🌟', 'Your rating has been submitted.');
      load();
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not submit rating'));
    } finally { setBusy(false); }
  };

  const payCash = async () => {
    setBusy(true);
    try {
      await api.post(`/booking/${id}/payment`, { method: 'cash' });
      Alert.alert('Confirmed', 'Cash payment selected. Pay after the work is done.');
      load();
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not confirm'));
    } finally { setBusy(false); }
  };

  const payOnline = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/booking/${id}/payment`, { method: 'online' });
      const order = res.data.razorpayOrder;
      if (order?.id) {
        router.push({ pathname: '/payment', params: { bookingId: String(id), orderId: order.id, amount: String(order.amount) } });
      } else {
        Alert.alert('Error', 'Could not start online payment.');
      }
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not start payment'));
    } finally { setBusy(false); }
  };

  const revealCode = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/customer/bookings/${id}/reveal-completion-code`);
      const pin = res.data.completionCode || res.data.pin;
      setBooking((b) => (b ? { ...b, completionPin: pin } : b));
      setShowPin(true);
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not reveal code'));
    } finally { setBusy(false); }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Brand.orange} /></View>;
  }
  if (!booking) {
    return <View style={styles.center}><Text style={{ color: Brand.textMuted }}>Booking not found</Text></View>;
  }

  const st = statusOf(booking.status);
  const workerBids = bids.filter((b) => typeof b.worker === 'object');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Booking Details</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Status + amount hero */}
        <View style={styles.statusCard}>
          <View style={{ flex: 1 }}>
            <View style={[styles.badge, { backgroundColor: st.bg }]}>
              <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
            </View>
            <Text style={styles.statusHint}>{formatDateTime(booking.createdAt)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amount}>{formatCurrency(booking.amount)}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Details */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="document-text-outline" size={18} color={Brand.navy} />
            <Text style={styles.cardTitle}>Service Details</Text>
          </View>
          <Text style={styles.detailText}>{booking.workDescription}</Text>
          {booking.customerLocation?.address ? (
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={16} color={Brand.textMuted} />
              <Text style={styles.locText}>{booking.customerLocation.address}</Text>
            </View>
          ) : null}
        </View>

        {/* Scheduled booking banner */}
        {booking.scheduledAt && !['completed', 'cancelled'].includes(booking.status) ? (
          <View style={styles.schedCard}>
            <Ionicons name="calendar" size={18} color="#1d4ed8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.schedTitle}>
                Scheduled for {new Date(booking.scheduledAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </Text>
              <Text style={styles.schedSub}>
                {Date.now() >= new Date(booking.scheduledAt).getTime()
                  ? 'The time has arrived — the worker can now start the job.'
                  : "The worker can only start at your chosen time. You'll both be notified when it arrives. Cancel anytime before then."}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Assigned worker */}
        {booking.assignedWorker ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="person-circle-outline" size={18} color={Brand.navy} />
              <Text style={styles.cardTitle}>Your Worker</Text>
            </View>
            <View style={styles.workerRow}>
              <View style={styles.wAvatar}><Text style={styles.wAvatarT}>{booking.assignedWorker.fullName?.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.wName}>{booking.assignedWorker.fullName}</Text>
                {booking.assignedWorker.phone ? <Text style={styles.wPhone}>{booking.assignedWorker.phone}</Text> : null}
              </View>
              {ratingValue(booking.assignedWorker.rating) ? (
                <View style={styles.ratingPill}><Ionicons name="star" size={12} color="#f59e0b" /><Text style={styles.ratingT}>{ratingValue(booking.assignedWorker.rating)!.toFixed(1)}</Text></View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Live tracking map */}
        {['worker_accepted', 'worker_approved', 'payment_done', 'in_progress'].includes(booking.status)
          && booking.customerLocation?.coordinates && booking.customerLocation.coordinates.length === 2 ? (
          workerBusy ? (
          <View style={styles.busyCard}>
            <View style={styles.busyIcon}>
              <Ionicons name="alert-circle" size={18} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.busyTitle}>Worker is currently busy</Text>
              <Text style={styles.busyText}>
                Your assigned worker is completing another job right now. Once that work is done, they will come to your location. Please be patient — your booking is confirmed.
              </Text>
            </View>
          </View>
          ) : (
          <View style={styles.card}>
            <View style={styles.trackHead}>
              <View style={styles.cardHead}>
                <Ionicons name="navigate-outline" size={18} color={Brand.navy} />
                <Text style={styles.cardTitle}>Live Tracking</Text>
              </View>
              <View style={styles.liveDot}>
                <View style={styles.liveDotInner} />
                <Text style={styles.liveText}>{workerLoc ? 'Worker on the way' : 'Waiting for location'}</Text>
              </View>
            </View>
            <TrackingMap
              customer={{ lat: booking.customerLocation.coordinates[1], lng: booking.customerLocation.coordinates[0] }}
              worker={workerLoc}
            />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} /><Text style={styles.legendText}>You</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#10b981' }]} /><Text style={styles.legendText}>Worker</Text></View>
            </View>
          </View>
          )
        ) : null}

        {/* Bids */}
        {['finding_workers', 'bids_received'].includes(booking.status) ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="pricetags-outline" size={18} color={Brand.navy} />
              <Text style={styles.cardTitle}>Worker Bids ({workerBids.length})</Text>
            </View>
            {workerBids.length === 0 ? (
              <View style={styles.waiting}>
                <ActivityIndicator color={Brand.orange} size="small" />
                <Text style={styles.waitingText}>Waiting for workers to bid…</Text>
              </View>
            ) : (
              workerBids.map((bid) => {
                const w = bid.worker as Worker;
                const ns = bid.negotiationStatus || 'none';
                const last = bid.negotiations && bid.negotiations.length ? bid.negotiations[bid.negotiations.length - 1] : null;
                const effective = ns === 'agreed' ? (bid.agreedAmount ?? bid.priceOffered)
                  : ns === 'worker_offered' && last ? last.amount
                  : bid.priceOffered;
                const isNeg = negotiatingBidId === bid._id;
                return (
                  <View key={bid._id} style={styles.bidCard}>
                    <View style={styles.bidTop}>
                      <View style={styles.wAvatarSm}><Text style={styles.wAvatarSmT}>{w.fullName?.charAt(0)}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bidName}>{w.fullName}</Text>
                        {ratingValue(w.rating) ? (
                          <View style={styles.bidRatingRow}>
                            <Ionicons name="star" size={11} color="#f59e0b" />
                            <Text style={styles.bidRating}>{ratingValue(w.rating)!.toFixed(1)}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.bidPrice}>{formatCurrency(effective)}</Text>
                    </View>

                    {ns === 'worker_offered' && last ? (
                      <View style={styles.negNotice}>
                        <Ionicons name="chatbubble-ellipses-outline" size={13} color={Brand.orangeDark} />
                        <Text style={styles.negHint}>Worker countered to {formatCurrency(last.amount)}</Text>
                      </View>
                    ) : ns === 'agreed' ? (
                      <View style={[styles.negNotice, { backgroundColor: Brand.successBg }]}>
                        <Ionicons name="checkmark-circle" size={13} color={Brand.success} />
                        <Text style={[styles.negHint, { color: Brand.success }]}>Worker agreed to your price</Text>
                      </View>
                    ) : ns === 'customer_offered' ? (
                      <View style={styles.negNotice}>
                        <Ionicons name="time-outline" size={13} color={Brand.orangeDark} />
                        <Text style={styles.negHint}>Waiting for worker to respond to your offer…</Text>
                      </View>
                    ) : null}

                    {isNeg ? (
                      <View style={styles.negInputRow}>
                        <View style={styles.amtInput}>
                          <Text style={styles.rupee}>₹</Text>
                          <TextInput style={styles.amtField} value={counterAmount} onChangeText={setCounterAmount} keyboardType="number-pad" placeholder="Your offer" placeholderTextColor={Brand.textLight} />
                        </View>
                        <TouchableOpacity style={styles.sendBtn} onPress={() => sendCounter(bid._id)} disabled={busy}><Text style={styles.sendT}>Send</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.cancelNeg} onPress={() => { setNegotiatingBidId(null); setCounterAmount(''); }}><Ionicons name="close" size={18} color={Brand.textMuted} /></TouchableOpacity>
                      </View>
                    ) : ns === 'customer_offered' ? null : (
                      <View style={styles.bidActions}>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptBid(bid._id)} disabled={busy} activeOpacity={0.9}>
                          <Ionicons name="checkmark" size={16} color={Brand.white} />
                          <Text style={styles.acceptT}>Accept {formatCurrency(effective)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.negBtn} onPress={() => { setNegotiatingBidId(bid._id); setCounterAmount(String(effective)); }} activeOpacity={0.9}>
                          <Ionicons name="swap-vertical" size={16} color={Brand.navy} />
                          <Text style={styles.negBtnT}>Negotiate</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {/* Payment (worker approved) */}
        {booking.status === 'worker_approved' ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="wallet-outline" size={18} color={Brand.navy} />
              <Text style={styles.cardTitle}>Payment</Text>
            </View>
            <View style={styles.payAmountBox}>
              <Text style={styles.payAmountLabel}>Total payable</Text>
              <Text style={styles.payAmount}>{formatCurrency(booking.amount)}</Text>
            </View>
            <TouchableOpacity style={styles.payOnlineBtn} onPress={payOnline} disabled={busy} activeOpacity={0.9}>
              <Ionicons name="card-outline" size={18} color={Brand.white} />
              <Text style={styles.payCashT}>Pay Online (UPI / Card)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.payCashBtn} onPress={payCash} disabled={busy} activeOpacity={0.9}>
              <Ionicons name="cash-outline" size={18} color={Brand.navy} />
              <Text style={styles.payCashTNavy}>Pay with Cash</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Completion code (payment done) — only after the worker requests it */}
        {['payment_done', 'in_progress'].includes(booking.status) ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="key-outline" size={18} color={Brand.navy} />
              <Text style={styles.cardTitle}>Completion Code</Text>
            </View>
            {booking.completionRequestedByWorkerAt ? (
              <>
                <Text style={styles.codeHint}>The worker has requested the completion code. Share it ONLY after the job is fully done.</Text>
                {showPin && booking.completionPin ? (
                  <View style={styles.pinBox}>
                    <Text style={styles.pinLabel}>Your completion code</Text>
                    <Text style={styles.pinText}>{booking.completionPin}</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.revealBtn} onPress={revealCode} disabled={busy} activeOpacity={0.9}>
                    <Ionicons name="eye-outline" size={18} color={Brand.navy} />
                    <Text style={styles.revealT}>Reveal Completion Code</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.waitRow}>
                <Ionicons name="time-outline" size={18} color={Brand.textMuted} />
                <Text style={styles.waitText}>The completion code will appear here once the worker marks the job done and requests it.</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Completed — show success + rating */}
        {booking.status === 'completed' ? (
          booking.review ? (
            <View style={styles.doneCard}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark-circle" size={40} color={Brand.success} />
              </View>
              <Text style={styles.doneText}>Job Completed</Text>
              <View style={{ flexDirection: 'row', gap: 3, marginTop: 6 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name={s <= (booking.review?.rating || 0) ? 'star' : 'star-outline'} size={20} color="#f59e0b" />
                ))}
              </View>
              <Text style={styles.thanksText}>Thanks for your feedback!</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.doneHead}>
                <Ionicons name="checkmark-circle" size={28} color={Brand.success} />
                <Text style={styles.doneHeadText}>Job Completed! Rate your worker</Text>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setStarRating(s)}>
                    <Ionicons name={s <= starRating ? 'star' : 'star-outline'} size={36} color="#f59e0b" />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Share your experience (optional)"
                placeholderTextColor={Brand.textLight}
                value={feedback}
                onChangeText={setFeedback}
                multiline
              />
              <TouchableOpacity style={[styles.submitReviewBtn, busy && { opacity: 0.6 }]} onPress={submitReview} disabled={busy} activeOpacity={0.9}>
                <Text style={styles.submitReviewT}>Submit Rating</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}

        {/* Cancel booking (before work starts) */}
        {['finding_workers', 'bids_received', 'worker_accepted', 'worker_approved'].includes(booking.status) ? (
          <TouchableOpacity style={styles.cancelBookingBtn} onPress={() => setShowCancel(true)} disabled={busy}>
            <Ionicons name="close-circle-outline" size={18} color={Brand.danger} />
            <Text style={styles.cancelBookingT}>Cancel Booking</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Cancel reason modal */}
      <Modal visible={showCancel} transparent animationType="slide" onRequestClose={() => setShowCancel(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel Booking</Text>
            <Text style={styles.modalSub}>Please tell us why you&apos;re cancelling. Workers will be notified.</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Reason for cancellation"
              placeholderTextColor={Brand.textLight}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.keepBtn} onPress={() => setShowCancel(false)}><Text style={styles.keepT}>Keep Booking</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmCancelBtn, busy && { opacity: 0.6 }]} onPress={doCancel} disabled={busy}>
                {busy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.confirmCancelT}>Cancel Booking</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.bg },
  topbar: { backgroundColor: Brand.navy, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, paddingBottom: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 18, padding: 16, marginHorizontal: 16, marginTop: 6 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  statusHint: { fontSize: 12, color: '#cfd8ee', marginTop: 8 },
  amountLabel: { fontSize: 11, color: '#cfd8ee', fontWeight: '600' },
  amount: { fontSize: 24, fontWeight: '900', color: Brand.success, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  card: { backgroundColor: Brand.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Brand.border, shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  schedCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 16, padding: 14 },
  schedTitle: { fontSize: 13.5, fontWeight: '800', color: '#1e40af' },
  schedSub: { fontSize: 11.5, color: '#1d4ed8', marginTop: 3, lineHeight: 16 },
  trackHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  liveDotInner: { height: 8, width: 8, borderRadius: 4, backgroundColor: Brand.success },
  liveText: { fontSize: 11.5, color: Brand.success, fontWeight: '700' },
  legendRow: { flexDirection: 'row', gap: 18, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { height: 10, width: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Brand.textMuted },
  detailText: { fontSize: 14, color: Brand.textMuted, lineHeight: 20 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  locText: { fontSize: 13, color: Brand.textMuted, flex: 1 },
  busyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fffbeb', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#fde68a' },
  busyIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  busyTitle: { fontSize: 13.5, fontWeight: '800', color: '#92400e' },
  busyText: { fontSize: 12, color: '#a16207', marginTop: 4, lineHeight: 18 },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wAvatar: { height: 48, width: 48, borderRadius: 24, backgroundColor: Brand.navy, alignItems: 'center', justifyContent: 'center' },
  wAvatarT: { color: Brand.white, fontWeight: '800', fontSize: 19 },
  wName: { fontSize: 15.5, fontWeight: '800', color: Brand.text },
  wPhone: { fontSize: 13, color: Brand.textMuted, marginTop: 2 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fffbeb', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  ratingT: { fontSize: 12, fontWeight: '700', color: '#b45309' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  waitingText: { fontSize: 13, color: Brand.textMuted },
  bidCard: { padding: 14, borderRadius: 16, backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, marginBottom: 10 },
  bidTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wAvatarSm: { height: 42, width: 42, borderRadius: 21, backgroundColor: Brand.navy50, alignItems: 'center', justifyContent: 'center' },
  wAvatarSmT: { color: Brand.navy, fontWeight: '800', fontSize: 16 },
  bidName: { fontSize: 14.5, fontWeight: '800', color: Brand.text },
  bidRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  bidRating: { fontSize: 12, color: Brand.textMuted, fontWeight: '600' },
  bidPrice: { fontSize: 18, fontWeight: '900', color: Brand.success },
  negNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.orange50, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 },
  negHint: { fontSize: 12.5, color: Brand.orangeDark, fontWeight: '700', flex: 1 },
  bidActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Brand.success, borderRadius: 12, paddingVertical: 12 },
  acceptT: { color: Brand.white, fontSize: 13.5, fontWeight: '800' },
  negBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Brand.navy50, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  negBtnT: { color: Brand.navy, fontSize: 13.5, fontWeight: '800' },
  negInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  amtInput: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 12 },
  rupee: { fontSize: 15, fontWeight: '800', color: Brand.textMuted },
  amtField: { flex: 1, paddingVertical: 11, paddingLeft: 4, fontSize: 15, fontWeight: '700', color: Brand.text },
  sendBtn: { backgroundColor: Brand.orange, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  sendT: { color: Brand.white, fontSize: 13, fontWeight: '800' },
  cancelNeg: { padding: 8 },
  payAmountBox: { backgroundColor: Brand.successBg, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 14 },
  payAmountLabel: { fontSize: 12, color: Brand.textMuted, fontWeight: '600' },
  payAmount: { fontSize: 28, fontWeight: '900', color: Brand.success, marginTop: 2 },
  payOnlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.orange, borderRadius: 14, paddingVertical: 15, marginBottom: 10 },
  payCashBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.card, borderWidth: 1.5, borderColor: Brand.navy, borderRadius: 14, paddingVertical: 15 },
  payCashT: { color: Brand.white, fontSize: 14.5, fontWeight: '800' },
  payCashTNavy: { color: Brand.navy, fontSize: 14.5, fontWeight: '800' },
  codeHint: { fontSize: 12.5, color: Brand.textMuted, marginBottom: 14, lineHeight: 18 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.navy50, borderRadius: 14, paddingVertical: 14 },
  revealT: { color: Brand.navy, fontSize: 14, fontWeight: '800' },
  pinBox: { backgroundColor: Brand.navy, borderRadius: 16, paddingVertical: 20, alignItems: 'center' },
  pinLabel: { color: '#cfd8ee', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  pinText: { color: Brand.white, fontSize: 34, fontWeight: '900', letterSpacing: 8 },
  doneCard: { alignItems: 'center', gap: 4, backgroundColor: Brand.successBg, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: '#a7f3d0' },
  doneIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  doneText: { fontSize: 17, fontWeight: '800', color: Brand.success },
  thanksText: { fontSize: 12.5, color: Brand.textMuted, marginTop: 4 },
  waitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  waitText: { flex: 1, fontSize: 13, color: Brand.textMuted, lineHeight: 18 },
  doneHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  doneHeadText: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  feedbackInput: { backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, padding: 14, fontSize: 14, color: Brand.text, height: 80, textAlignVertical: 'top' },
  submitReviewBtn: { backgroundColor: Brand.orange, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  submitReviewT: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  cancelBookingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.dangerBg, borderRadius: 16, paddingVertical: 15, borderWidth: 1, borderColor: '#fecaca' },
  cancelBookingT: { color: Brand.danger, fontSize: 14.5, fontWeight: '800' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Brand.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  modalSub: { fontSize: 13, color: Brand.textMuted, marginTop: 4, marginBottom: 14 },
  reasonInput: { backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, padding: 14, fontSize: 14.5, color: Brand.text, height: 90, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  keepBtn: { flex: 1, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  keepT: { color: Brand.textMuted, fontWeight: '700' },
  confirmCancelBtn: { flex: 1, backgroundColor: Brand.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmCancelT: { color: Brand.white, fontWeight: '800' },
});
