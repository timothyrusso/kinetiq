import { StyleSheet } from 'react-native';
import { type Theme, touchTarget } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    button: { width: touchTarget * 0.8, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.45 },
    disabled: { opacity: 0.4 },
  });
