import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ThemeColors } from '@/lib/theme';

export type AppAlertButtonStyle = 'default' | 'cancel' | 'destructive';
export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: AppAlertButtonStyle;
}
type AppAlertKind = 'success' | 'error' | 'warning' | 'info';

interface AppAlertData {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  kind: AppAlertKind;
}

// Same keyword-sniffing everywhere a title/message decides the icon — no call
// site has to pick a kind, so `appAlert(...)` stays a drop-in for `Alert.alert(...)`.
const inferKind = (title: string, message?: string): AppAlertKind => {
  const t = `${title} ${message || ''}`.toLowerCase();
  if (/(error|fail|invalid|wrong|denied|cannot|can't|unable|not available|not found|expired|timed out|timeout|already|required|needed|please)/.test(t)) {
    return /error|fail|invalid|wrong|denied|cannot|can't|unable|not available|not found|expired|timed out|timeout/.test(t) ? 'error' : 'warning';
  }
  if (/(success|sent|done|set!|created|confirmed|accepted|completed|thank you|welcome|verified|updated|saved|placed|booked)/.test(t)) return 'success';
  return 'info';
};

let showFn: ((title: string, message?: string, buttons?: AppAlertButton[]) => void) | null = null;
let idCounter = 0;

/**
 * Drop-in replacement for React Native's `Alert.alert(title, message, buttons)` —
 * same signature, but renders a themed in-app modal instead of the bare OS dialog.
 */
export const appAlert = (title: string, message?: string, buttons?: AppAlertButton[]) => {
  showFn?.(title, message, buttons);
};

/** Mount once in the root layout, alongside ToastProvider. */
export function AppAlertProvider() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [queue, setQueue] = useState<AppAlertData[]>([]);

  useEffect(() => {
    showFn = (title, message, buttons) => {
      const id = ++idCounter;
      setQueue((p) => [...p, {
        id, title, message,
        buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
        kind: inferKind(title, message),
      }]);
    };
    return () => { showFn = null; };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const dismiss = (btn: AppAlertButton) => {
    setQueue((p) => p.filter((a) => a.id !== current.id));
    btn.onPress?.();
  };

  const iconFor: Record<AppAlertKind, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
    success: { name: 'checkmark-circle', color: colors.success, bg: colors.successBg },
    error: { name: 'close-circle', color: colors.danger, bg: colors.dangerBg },
    warning: { name: 'alert-circle', color: colors.warn, bg: colors.warnBg },
    info: { name: 'information-circle', color: colors.info, bg: colors.infoBg },
  };
  const icon = iconFor[current.kind];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => dismiss(current.buttons[current.buttons.length - 1])}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={30} color={icon.color} />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

          <View style={[styles.btnRow, current.buttons.length > 2 && styles.btnCol]}>
            {current.buttons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    isDestructive ? styles.btnDestructive : isCancel ? styles.btnCancel : styles.btnDefault,
                    current.buttons.length > 2 && styles.btnFull,
                  ]}
                  onPress={() => dismiss(btn)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.btnText, isDestructive ? styles.btnTextDestructive : isCancel ? styles.btnTextCancel : styles.btnTextDefault]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  scrim: { flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: c.card, borderRadius: 22, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16,
  },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', color: c.text, textAlign: 'center' },
  message: { fontSize: 13.5, color: c.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' },
  btnCol: { flexDirection: 'column' },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnFull: { flex: undefined, width: '100%' },
  btnDefault: { backgroundColor: c.orange },
  btnCancel: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border },
  btnDestructive: { backgroundColor: c.dangerBg, borderWidth: 1, borderColor: c.danger },
  btnText: { fontSize: 14.5, fontWeight: '800' },
  btnTextDefault: { color: c.white },
  btnTextCancel: { color: c.textMuted },
  btnTextDestructive: { color: c.danger },
});
