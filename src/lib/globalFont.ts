import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

/**
 * Applies Plus Jakarta Sans app-wide without editing every screen's StyleSheet.
 *
 * React Native does NOT synthesise bold weights for custom fonts — each weight is a
 * separate font file. So we map the requested `fontWeight` to the matching Plus Jakarta
 * file and drop the numeric weight (the file already carries the weight).
 */
const FAMILY_BY_WEIGHT: Record<string, string> = {
  '100': 'PlusJakartaSans_400Regular',
  '200': 'PlusJakartaSans_400Regular',
  '300': 'PlusJakartaSans_400Regular',
  '400': 'PlusJakartaSans_400Regular',
  normal: 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  bold: 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  '900': 'PlusJakartaSans_800ExtraBold',
};

let applied = false;

export function applyGlobalFont(): void {
  if (applied) return;
  applied = true;

  ([Text, TextInput] as unknown as { render?: (...a: unknown[]) => React.ReactElement | null }[]).forEach((Comp) => {
    const original = Comp.render;
    if (typeof original !== 'function') return;

    Comp.render = function patchedRender(...args: unknown[]) {
      const element = original.apply(this, args);
      if (!element || !React.isValidElement(element)) return element;

      const props = element.props as { style?: unknown };
      const flat = (StyleSheet.flatten(props.style as never) || {}) as {
        fontFamily?: string;
        fontWeight?: string | number;
      };

      // Respect an explicitly set custom font family; otherwise map from weight.
      const weight = String(flat.fontWeight ?? '400');
      const fontFamily = flat.fontFamily || FAMILY_BY_WEIGHT[weight] || 'PlusJakartaSans_400Regular';

      return React.cloneElement(element as React.ReactElement, {
        style: [{ fontFamily }, props.style, { fontWeight: undefined }],
      } as never);
    };
  });
}
