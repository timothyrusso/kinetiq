import { Platform, StyleSheet } from 'react-native';
import { type Theme, touchTarget } from '@/features/core/theme';

const SWATCH = 36;

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    // NOTE: Android answers a press with the ripple; iOS dims, as its own controls do.
    pressed: { opacity: Platform.select({ ios: 0.5, default: 1 }) },
    hit: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
    ring: { borderWidth: 2, borderRadius: SWATCH, padding: 2 },
    swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, alignItems: 'center', justifyContent: 'center' },
  });
