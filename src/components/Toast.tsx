import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Brand } from '@/lib/config';

type ToastType = 'success' | 'error' | 'info';
interface ToastData { message: string; type: ToastType; id: number; }

let showToastFn: ((msg: string, type?: ToastType) => void) | null = null;
let idCounter = 0;

/** Call this anywhere to show a toast */
export const toast = {
  success: (msg: string) => showToastFn?.(msg, 'success'),
  error: (msg: string) => showToastFn?.(msg, 'error'),
  info: (msg: string) => showToastFn?.(msg, 'info'),
};

/** Place this once in your root layout */
export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    showToastFn = (message, type = 'info') => {
      const id = ++idCounter;
      setToasts((p) => [...p, { message, type, id }]);
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
    };
    return () => { showToastFn = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {toasts.map((t) => <ToastItem key={t.id} data={t} />)}
    </View>
  );
}

function ToastItem({ data }: { data: ToastData }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 2800);
    return () => clearTimeout(t);
  }, []);

  const bg = data.type === 'success' ? Brand.success : data.type === 'error' ? Brand.danger : Brand.navy;
  const icon = data.type === 'success' ? 'checkmark-circle' : data.type === 'error' ? 'alert-circle' : 'information-circle';

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity, transform: [{ translateY }] }]}>
      <Ionicons name={icon} size={20} color={Brand.white} />
      <Text style={styles.text}>{data.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 60, left: 16, right: 16, zIndex: 9999, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  text: { color: Brand.white, fontSize: 14, fontWeight: '700', flex: 1 },
});
