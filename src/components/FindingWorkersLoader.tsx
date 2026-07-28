import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Brand } from '@/lib/config';

/**
 * Friendly "searching" loader shown while a booking is in `finding_workers` with no bids yet.
 * Rotates through reassuring messages with animated dots + a radar-style ripple so the wait
 * feels alive rather than stuck.
 */
const MESSAGES = [
  'Finding nearby workers',
  'Notifying available workers',
  'Matching the best workers for you',
  'Almost there, hang tight',
];

export default function FindingWorkersLoader() {
  const [idx, setIdx] = useState(0);
  const [dots, setDots] = useState('.');
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const msgTimer = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 2000);
    const dotTimer = setInterval(() => setDots((d) => (d.length >= 3 ? '.' : `${d}.`)), 450);
    const loop = Animated.loop(
      Animated.timing(ripple, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => { clearInterval(msgTimer); clearInterval(dotTimer); loop.stop(); };
  }, [ripple]);

  const scale = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.9] });
  const opacity = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={styles.wrap}>
      <View style={styles.iconStack}>
        <Animated.View style={[styles.ripple, { transform: [{ scale }], opacity }]} />
        <View style={styles.iconCore}><Ionicons name="search" size={18} color={Brand.white} /></View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.msg}>
          {MESSAGES[idx]}<Text style={styles.dots}>{dots}</Text>
        </Text>
        <Text style={styles.sub}>We&rsquo;re reaching out to workers near you</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 },
  iconStack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.orange },
  iconCore: { width: 38, height: 38, borderRadius: 19, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' },
  msg: { fontSize: 14, fontWeight: '800', color: Brand.text },
  dots: { color: Brand.orange },
  sub: { fontSize: 11.5, color: Brand.textMuted, marginTop: 2 },
});
