import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * App-wide light/dark theming.
 *
 * `ThemeColors` deliberately mirrors the key names of the legacy `Brand` object in
 * `lib/config.ts`, so a screen is migrated by swapping `Brand.x` for `colors.x` and moving its
 * StyleSheet into a `useMemo`. Screens that still read `Brand` keep working — they just stay
 * light — which lets the migration happen screen by screen instead of in one risky sweep.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  navy: string;
  navyLight: string;
  navy50: string;
  orange: string;
  orangeDark: string;
  orange50: string;
  amber: string;
  /** Screen background. */
  bg: string;
  /** Raised surface: cards, sheets. */
  card: string;
  /** Recessed surface: inputs, icon chips, image placeholders. */
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  textLight: string;
  success: string;
  successBg: string;
  danger: string;
  dangerBg: string;
  /** Amber "heads up" pair — used by warning cards and rating pills. */
  warn: string;
  warnBg: string;
  /** Blue informational pair — scheduled-time cards, hints. */
  info: string;
  infoBg: string;
  /** Decorative menu/category accents. Both must stay legible on `card`/`surface`. */
  accentPurple: string;
  accentTeal: string;
  white: string;
  /** Colour for content placed on the orange accent. */
  onAccent: string;
  /**
   * Colour for content placed on a surface that is *always* white, regardless of
   * theme — the Google sign-in button (Google's own brand guideline requires a
   * white button), small white icon chips, and anything else built with a fixed
   * `white` fill rather than the themed `card`/`surface`. `text` is the wrong
   * choice for these: it is near-white in dark mode, which is legible against
   * `card`/`surface` but invisible against a fill that never changes with the
   * theme. Same value in both palettes on purpose, for the same reason `white`
   * itself is.
   */
  onWhite: string;
  /** Scrim behind modals and the drawer. */
  scrim: string;
}

const LIGHT: ThemeColors = {
  navy: '#0f1c3f',
  navyLight: '#1a2d5a',
  navy50: '#eef1f8',
  orange: '#f97316',
  orangeDark: '#ea580c',
  orange50: '#fff7ed',
  amber: '#f59e0b',
  bg: '#f6f7fb',
  card: '#ffffff',
  surface: '#f1f2f7',
  border: '#e8eaf0',
  text: '#0f1c3f',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  success: '#10b981',
  successBg: '#ecfdf5',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
  warn: '#b45309',
  warnBg: '#fffbeb',
  info: '#1d4ed8',
  infoBg: '#eff6ff',
  accentPurple: '#7c3aed',
  accentTeal: '#0e7490',
  white: '#ffffff',
  onAccent: '#ffffff',
  onWhite: '#1f2937',
  scrim: 'rgba(15,28,63,0.55)',
};

const DARK: ThemeColors = {
  navy: '#16181d',
  navyLight: '#20242c',
  navy50: '#1c1f26',
  orange: '#f97316',
  orangeDark: '#ea580c',
  orange50: '#2a1608',
  amber: '#fbbf24',
  bg: '#0b0d10',
  card: '#16181d',
  surface: '#1c1f26',
  border: '#282c35',
  text: '#f3f4f6',
  textMuted: '#9aa3af',
  textLight: '#6f7885',
  success: '#34d399',
  successBg: '#062e22',
  danger: '#f87171',
  dangerBg: '#3a1414',
  warn: '#fbbf24',
  warnBg: '#2a1e08',
  info: '#93c5fd',
  infoBg: '#0f1d33',
  accentPurple: '#c4b5fd',
  accentTeal: '#67e8f9',
  white: '#ffffff',
  onAccent: '#ffffff',
  onWhite: '#1f2937',
  scrim: 'rgba(0,0,0,0.62)',
};

const STORAGE_KEY = 'fixo.theme.mode';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Restore the saved preference once on launch.
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, isDark, colors: isDark ? DARK : LIGHT, setMode, toggleTheme }),
    [mode, isDark, setMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}

/** Palettes for the rare case a value is needed outside React (e.g. navigation options). */
export const ThemePalettes = { light: LIGHT, dark: DARK } as const;
