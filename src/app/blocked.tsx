import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { refreshMe, logout } from '@/store/authSlice';
import { Brand } from '@/lib/config';

const fmt = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
};

export default function BlockedScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { block } = useAppSelector((s) => s.auth);

  const until = block?.blockedUntil ? new Date(block.blockedUntil).getTime() : 0;
  const [remaining, setRemaining] = useState(until ? Math.max(0, until - Date.now()) : 0);
  const [checking, setChecking] = useState(false);

  // Live countdown; when it hits zero, ask the server to confirm unblock.
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => {
      const left = Math.max(0, until - Date.now());
      setRemaining(left);
      if (left <= 0) { clearInterval(t); dispatch(refreshMe()); }
    }, 1000);
    return () => clearInterval(t);
  }, [until, dispatch]);

  // Periodic re-check in case admin unblocks early (socket also handles this).
  useEffect(() => {
    const t = setInterval(() => dispatch(refreshMe()), 30000);
    return () => clearInterval(t);
  }, [dispatch]);

  const checkNow = async () => { setChecking(true); await dispatch(refreshMe()); setChecking(false); };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[Brand.navy, '#13284f', '#0a1430']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.iconCircle}><Ionicons name="lock-closed" size={40} color={Brand.amber} /></View>
        <Text style={styles.title}>Account Temporarily Restricted</Text>
        <Text style={styles.sub}>
          Aapka account kuch der ke liye restrict kiya gaya hai. Is dauraan aap nayi booking nahi kar paayenge.
        </Text>

        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>Unblocks in</Text>
          <Text style={styles.timer}>{fmt(remaining)}</Text>
        </View>

        {block?.reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{block.reason}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.helpBtn} onPress={() => router.push('/help')} activeOpacity={0.9}>
          <Ionicons name="help-buoy-outline" size={18} color={Brand.white} />
          <Text style={styles.helpT}>Get Help &amp; Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkBtn} onPress={checkNow} disabled={checking}>
          {checking ? <ActivityIndicator color="#cfd8ee" /> : <><Ionicons name="refresh" size={15} color="#cfd8ee" /><Text style={styles.checkT}>Check status</Text></>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logout())}>
          <Text style={styles.logoutT}>Log out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.navy },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  iconCircle: { width: 86, height: 86, borderRadius: 43, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { color: Brand.white, fontSize: 21, fontWeight: '800', textAlign: 'center', marginTop: 20 },
  sub: { color: '#aab8d8', fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  timerBox: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 40, marginTop: 24 },
  timerLabel: { color: '#8fa0c4', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  timer: { color: Brand.amber, fontSize: 36, fontWeight: '800', marginTop: 6, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  reasonBox: { alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginTop: 18 },
  reasonLabel: { color: '#8fa0c4', fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase' },
  reasonText: { color: '#e5e9f3', fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.orange, borderRadius: 14, paddingVertical: 15, alignSelf: 'stretch', marginTop: 24 },
  helpT: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  checkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  checkT: { color: '#cfd8ee', fontSize: 13.5, fontWeight: '700' },
  logoutBtn: { marginTop: 20 },
  logoutT: { color: '#8fa0c4', fontSize: 13, fontWeight: '700' },
});
