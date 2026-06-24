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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Rewards</Text>

        <LinearGradient colors={[Brand.navy, '#1a2d5a']} style={styles.hero}>
          <View style={styles.heroRow}>
            <Ionicons name="gift" size={20} color={Brand.white} />
            <Text style={styles.heroLabel}>FIXO REWARDS</Text>
          </View>
          <Text style={styles.heroNum}>{completed}</Text>
          <Text style={styles.heroSub}>completed bookings</Text>

          {nextM ? (
            <View style={styles.progressBox}>
              <View style={styles.progressTop}>
                <Text style={styles.progressLabel}>Next: {nextM.label} ({formatCurrency(nextM.rewardAmount)})</Text>
                <Text style={styles.progressCount}>{completed}/{nextM.bookingsRequired}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${nextM.progressPercent}%` }]} />
              </View>
            </View>
          ) : (
            <Text style={styles.allDone}>🎉 All milestones unlocked!</Text>
          )}
          {totalClaimed > 0 ? <Text style={styles.earned}>Total earned: {formatCurrency(totalClaimed)}</Text> : null}
        </LinearGradient>

        {loading ? (
          <ActivityIndicator color={Brand.orange} style={{ marginTop: 30 }} />
        ) : (
          <View style={{ gap: 12, marginTop: 20 }}>
            {milestones.map((m) => (
              <View key={m.key} style={[styles.mCard, m.claimable && styles.mCardActive]}>
                <View style={styles.mTop}>
                  <View style={[styles.trophy, { backgroundColor: m.achieved ? Brand.successBg : Brand.bg }]}>
                    <Ionicons name="trophy" size={20} color={m.achieved ? Brand.success : Brand.textLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mLabel}>{m.label}</Text>
                    <Text style={styles.mReq}>{m.bookingsRequired} completed bookings</Text>
                  </View>
                  <Text style={styles.mAmount}>{formatCurrency(m.rewardAmount)}</Text>
                </View>

                <View style={styles.trackSm}>
                  <View style={[styles.fillSm, { width: `${m.progressPercent}%`, backgroundColor: m.achieved ? Brand.success : Brand.orange }]} />
                </View>

                {m.claimStatus === 'rejected' && m.claimRejectionReason ? (
                  <Text style={styles.rejectNote}>Rejected: {m.claimRejectionReason}. You can claim again.</Text>
                ) : null}

                <View style={styles.mBottom}>
                  <Text style={styles.mProg}>{completed}/{m.bookingsRequired}</Text>
                  {m.claimed ? claimBadge(m.claimStatus) : m.claimable ? (
                    <TouchableOpacity style={styles.claimBtn} onPress={() => setClaimM(m)}>
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
  heading: { fontSize: 22, fontWeight: '800', color: Brand.text, marginBottom: 16 },
  hero: { borderRadius: 22, padding: 22 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLabel: { color: '#aab8d8', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroNum: { color: Brand.white, fontSize: 40, fontWeight: '900', marginTop: 10 },
  heroSub: { color: '#aab8d8', fontSize: 13 },
  progressBox: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 12, marginTop: 16 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: '#dbe3f4', fontSize: 11.5, flex: 1 },
  progressCount: { color: Brand.white, fontSize: 11.5, fontWeight: '800' },
  track: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: Brand.orange, borderRadius: 4 },
  allDone: { color: '#6ee7b7', fontSize: 14, fontWeight: '700', marginTop: 14 },
  earned: { color: '#aab8d8', fontSize: 12, marginTop: 12 },
  mCard: { backgroundColor: Brand.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Brand.border },
  mCardActive: { borderColor: '#a7f3d0' },
  mTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trophy: { height: 44, width: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mLabel: { fontSize: 15, fontWeight: '800', color: Brand.text },
  mReq: { fontSize: 12, color: Brand.textMuted, marginTop: 1 },
  mAmount: { fontSize: 16, fontWeight: '800', color: Brand.text },
  trackSm: { height: 7, backgroundColor: Brand.bg, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  fillSm: { height: 7, borderRadius: 4 },
  rejectNote: { fontSize: 11.5, color: Brand.danger, marginTop: 8 },
  mBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  mProg: { fontSize: 12, color: Brand.textMuted },
  claimBtn: { backgroundColor: Brand.orange, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  claimBtnT: { color: Brand.white, fontSize: 12.5, fontWeight: '800' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockT: { fontSize: 12, color: Brand.textLight },
  cBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  cBadgeT: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Brand.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  modalSub: { fontSize: 13, color: Brand.textMuted, marginTop: 4, marginBottom: 14 },
  mInput: { backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14.5, color: Brand.text, marginBottom: 10 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelT: { color: Brand.textMuted, fontWeight: '700' },
  submitBtn: { flex: 1, backgroundColor: Brand.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitT: { color: Brand.white, fontWeight: '800' },
});
