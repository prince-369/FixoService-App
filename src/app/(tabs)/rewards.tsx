import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import api, { getApiError } from '@/lib/api';
import { Brand } from '@/lib/config';
import { formatCurrency } from '@/lib/format';

interface Milestone {
  key: string;
  label: string;
  bookingsRequired: number;
  rewardAmount: number;
  achieved: boolean;
  claimed: boolean;
  claimable: boolean;
  claimStatus: string | null;
  claimRejectionReason?: string | null;
  progressPercent: number;
}

export default function RewardsScreen() {
  const [completed, setCompleted] = useState(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [nextM, setNextM] = useState<Milestone | null>(null);
  const [totalClaimed, setTotalClaimed] = useState(0);
  const [loading, setLoading] = useState(true);

  const [claimM, setClaimM] = useState<Milestone | null>(null);
  const [holderName, setHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accNo, setAccNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/customer/rewards');
      setCompleted(res.data.completedBookings || 0);
      setMilestones(res.data.milestones || []);
      setNextM(res.data.nextMilestone || null);
      setTotalClaimed(res.data.totalClaimedAmount || 0);
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitClaim = async () => {
    if (!claimM) return;
    if (!holderName.trim() || !bankName.trim() || !accNo.trim() || !ifsc.trim()) {
      Alert.alert('Missing details', 'Please fill all bank fields.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/customer/rewards/${claimM.key}/claim`, {
        method: 'bank',
        holderName: holderName.trim(),
        bankName: bankName.trim(),
        bankAccountNumber: accNo.trim(),
        ifscCode: ifsc.trim().toUpperCase(),
      });
      setClaimM(null);
      setHolderName(''); setBankName(''); setAccNo(''); setIfsc('');
      Alert.alert('Claim submitted! 🎉', 'Your reward will be transferred to your bank account within 24 hours.');
      load();
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not submit claim'));
    } finally {
      setSubmitting(false);
    }
  };

  const claimBadge = (status: string | null) => {
    const map: Record<string, { t: string; c: string; b: string }> = {
      pending_approval: { t: 'Pending', c: '#b45309', b: '#fef3c7' },
      paid: { t: 'Success', c: '#047857', b: '#d1fae5' },
      rejected: { t: 'Rejected', c: '#b91c1c', b: '#fee2e2' },
    };
    const s = map[status || ''];
    if (!s) return null;
    return <View style={[styles.cBadge, { backgroundColor: s.b }]}><Text style={[styles.cBadgeT, { color: s.c }]}>{s.t}</Text></View>;
  };

  const claimableCount = milestones.filter((m) => m.claimable && !m.claimed).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Celebratory green hero */}
        <LinearGradient colors={[Brand.success, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}><Ionicons name="gift" size={20} color={Brand.white} /></View>
            <Text style={styles.heroLabel}>FIXO REWARDS</Text>
          </View>
          <Text style={styles.heroNum}>{completed}</Text>
          <Text style={styles.heroSub}>completed bookings 🎉</Text>

          {nextM ? (
            <View style={styles.progressBox}>
              <View style={styles.progressTop}>
                <Text style={styles.progressLabel} numberOfLines={1}>Next: {nextM.label} · {formatCurrency(nextM.rewardAmount)}</Text>
                <Text style={styles.progressCount}>{completed}/{nextM.bookingsRequired}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${nextM.progressPercent}%` }]} />
              </View>
              <Text style={styles.progressHint}>
                {Math.max(nextM.bookingsRequired - completed, 0)} more booking{nextM.bookingsRequired - completed === 1 ? '' : 's'} to unlock
              </Text>
            </View>
          ) : (
            <View style={styles.allDoneBox}>
              <Ionicons name="sparkles" size={16} color={Brand.white} />
              <Text style={styles.allDone}>All milestones unlocked!</Text>
            </View>
          )}
        </LinearGradient>

        {/* Total earned card */}
        {totalClaimed > 0 ? (
          <View style={styles.earnedCard}>
            <View style={styles.earnedIcon}><Ionicons name="cash" size={20} color={Brand.success} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.earnedLabel}>Total Rewards Earned</Text>
              <Text style={styles.earnedValue}>{formatCurrency(totalClaimed)}</Text>
            </View>
            <View style={styles.earnedBadge}><Text style={styles.earnedBadgeT}>Yours 💚</Text></View>
          </View>
        ) : null}

        {/* Milestones section */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          {claimableCount > 0 ? (
            <View style={styles.readyChip}><Text style={styles.readyChipT}>{claimableCount} ready</Text></View>
          ) : milestones.length > 0 ? (
            <Text style={styles.sectionCount}>{milestones.length}</Text>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={Brand.orange} style={{ marginTop: 30 }} />
        ) : milestones.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="trophy-outline" size={36} color={Brand.textLight} /></View>
            <Text style={styles.emptyTitle}>No milestones yet</Text>
            <Text style={styles.emptySub}>Complete bookings to start earning rewards.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {milestones.map((m) => (
              <View key={m.key} style={[styles.mCard, m.claimable && !m.claimed && styles.mCardActive]}>
                <View style={styles.mTop}>
                  <View style={[styles.trophy, { backgroundColor: m.achieved ? Brand.successBg : Brand.bg }]}>
                    <Ionicons name="trophy" size={22} color={m.achieved ? Brand.success : Brand.textLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mLabel}>{m.label}</Text>
                    <Text style={styles.mReq}>{m.bookingsRequired} completed bookings</Text>
                  </View>
                  <Text style={[styles.mAmount, m.achieved && { color: Brand.success }]}>{formatCurrency(m.rewardAmount)}</Text>
                </View>

                <View style={styles.trackSm}>
                  <View style={[styles.fillSm, { width: `${m.progressPercent}%`, backgroundColor: m.achieved ? Brand.success : Brand.orange }]} />
                </View>

                {m.claimStatus === 'rejected' && m.claimRejectionReason ? (
                  <Text style={styles.rejectNote}>Rejected: {m.claimRejectionReason}. You can claim again.</Text>
                ) : null}

                <View style={styles.mBottom}>
                  <Text style={styles.mProg}>{completed}/{m.bookingsRequired} bookings</Text>
                  {m.claimed ? claimBadge(m.claimStatus) : m.claimable ? (
                    <TouchableOpacity style={styles.claimBtn} activeOpacity={0.85} onPress={() => setClaimM(m)}>
                      <Ionicons name="gift" size={14} color={Brand.white} />
                      <Text style={styles.claimBtnT}>{m.claimStatus === 'rejected' ? 'Claim Again' : `Claim ${formatCurrency(m.rewardAmount)}`}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.lockRow}><Ionicons name="lock-closed" size={12} color={Brand.textLight} /><Text style={styles.lockT}>Locked</Text></View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Claim modal */}
      <Modal visible={!!claimM} transparent animationType="slide" onRequestClose={() => setClaimM(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}><Ionicons name="gift" size={26} color={Brand.success} /></View>
            <Text style={styles.modalTitle}>Claim {formatCurrency(claimM?.rewardAmount)}</Text>
            <Text style={styles.modalSub}>Enter your bank details. Reward transfers within 24 hours.</Text>
            {[
              { ph: 'Account holder name', v: holderName, set: setHolderName },
              { ph: 'Bank name', v: bankName, set: setBankName },
              { ph: 'Account number', v: accNo, set: setAccNo },
              { ph: 'IFSC code', v: ifsc, set: setIfsc },
            ].map((f) => (
              <TextInput key={f.ph} style={styles.mInput} placeholder={f.ph} placeholderTextColor={Brand.textLight} value={f.v} onChangeText={f.set} autoCapitalize={f.ph === 'IFSC code' ? 'characters' : 'words'} />
            ))}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setClaimM(null)}><Text style={styles.cancelT}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submitClaim} disabled={submitting}>
                {submitting ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.submitT}>Claim Reward</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  hero: { borderRadius: 22, padding: 22 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroIcon: { height: 34, width: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroNum: { color: Brand.white, fontSize: 44, fontWeight: '900', marginTop: 12 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13.5, fontWeight: '600' },
  progressBox: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, padding: 14, marginTop: 18 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progressLabel: { color: Brand.white, fontSize: 12, fontWeight: '700', flex: 1 },
  progressCount: { color: Brand.white, fontSize: 12, fontWeight: '800' },
  track: { height: 9, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 5, marginTop: 10, overflow: 'hidden' },
  fill: { height: 9, backgroundColor: Brand.white, borderRadius: 5 },
  progressHint: { color: 'rgba(255,255,255,0.9)', fontSize: 11.5, fontWeight: '600', marginTop: 8 },
  allDoneBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, padding: 14, marginTop: 18 },
  allDone: { color: Brand.white, fontSize: 14, fontWeight: '800' },
  earnedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Brand.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Brand.border, marginTop: 14 },
  earnedIcon: { height: 42, width: 42, borderRadius: 13, backgroundColor: Brand.successBg, alignItems: 'center', justifyContent: 'center' },
  earnedLabel: { fontSize: 12.5, fontWeight: '700', color: Brand.textMuted },
  earnedValue: { fontSize: 20, fontWeight: '900', color: Brand.success, marginTop: 2 },
  earnedBadge: { backgroundColor: Brand.successBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  earnedBadgeT: { color: '#047857', fontSize: 11.5, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Brand.text },
  sectionCount: { fontSize: 12, fontWeight: '700', color: Brand.orange, backgroundColor: Brand.orange50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  readyChip: { backgroundColor: Brand.successBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  readyChipT: { fontSize: 11.5, fontWeight: '800', color: '#047857' },
  empty: { alignItems: 'center', marginTop: 30, gap: 6, paddingHorizontal: 30 },
  emptyIcon: { height: 84, width: 84, borderRadius: 42, backgroundColor: Brand.navy50, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  emptySub: { fontSize: 13.5, color: Brand.textMuted, textAlign: 'center' },
  mCard: { backgroundColor: Brand.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Brand.border },
  mCardActive: { borderColor: Brand.success, borderWidth: 1.5 },
  mTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trophy: { height: 46, width: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mLabel: { fontSize: 15.5, fontWeight: '800', color: Brand.text },
  mReq: { fontSize: 12, color: Brand.textMuted, marginTop: 1 },
  mAmount: { fontSize: 16.5, fontWeight: '900', color: Brand.text },
  trackSm: { height: 8, backgroundColor: Brand.bg, borderRadius: 4, marginTop: 14, overflow: 'hidden' },
  fillSm: { height: 8, borderRadius: 4 },
  rejectNote: { fontSize: 11.5, color: Brand.danger, marginTop: 8 },
  mBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  mProg: { fontSize: 12, color: Brand.textMuted, fontWeight: '600' },
  claimBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.success, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  claimBtnT: { color: Brand.white, fontSize: 12.5, fontWeight: '800' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockT: { fontSize: 12, color: Brand.textLight, fontWeight: '600' },
  cBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  cBadgeT: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Brand.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalIcon: { height: 52, width: 52, borderRadius: 16, backgroundColor: Brand.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: Brand.text },
  modalSub: { fontSize: 13, color: Brand.textMuted, marginTop: 4, marginBottom: 14 },
  mInput: { backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14.5, color: Brand.text, marginBottom: 10 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelT: { color: Brand.textMuted, fontWeight: '700' },
  submitBtn: { flex: 1, backgroundColor: Brand.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitT: { color: Brand.white, fontWeight: '800' },
});
