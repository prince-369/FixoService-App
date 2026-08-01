import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ThemeColors } from '@/lib/theme';

/**
 * Header light/dark switch.
 *
 * Tapping it sets an explicit 'light' or 'dark' (never back to 'system') — a user who
 * reaches for this control wants to pin the theme. 'System' stays available in Settings.
 *
 * `tint` lets it sit on a navy header, where the icon has to be white rather than
 * following the palette's text colour.
 */
export default function ThemeToggle({ size = 22, tint }: { size?: number; tint?: string }) {
  const { colors, isDark, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => setMode(isDark ? 'light' : 'dark')}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      hitSlop={8}
    >
      <Ionicons
        name={isDark ? 'sunny-outline' : 'moon-outline'}
        size={size}
        color={tint ?? colors.text}
      />
    </TouchableOpacity>
  );
}

const createStyles = (_c: ThemeColors) =>
  StyleSheet.create({
    // padding matches the sibling header buttons so the row stays optically even.
    btn: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  });
