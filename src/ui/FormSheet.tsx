/**
 * The body of a form-sheet route: the native sheet's header, and the column under it.
 *
 * Editors are routes presented as the platform's own sheet (`presentation: 'formSheet'`, with
 * a grabber and detents), not a sheet drawn in JavaScript. The sheet's header is a native
 * header like any other screen's: a title, and the confirming action as a text button in the
 * trailing slot. A screen that is a form reads its input from route params and writes through
 * the stores and queries the rest of the app already uses; it never receives a callback.
 *
 * `fit` bodies are plain views so a `fitToContents` detent can measure them. Taller editors
 * (the exercise picker) scroll, and use the list inside them instead of this body.
 */
import { memo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { useAppTheme } from '@/theme/theme';
import { screenGutter, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/ui/Screen';
import { Txt } from '@/ui/Text';

export function FormSheet({
  title,
  doneLabel,
  onDone,
  doneDisabled = false,
  scroll = false,
  children,
}: {
  title: string;
  /** The trailing text action. Defaults to closing the sheet under the label "Done". */
  doneLabel?: TKey;
  onDone?: () => void;
  doneDisabled?: boolean;
  /** For bodies taller than a phone's half height. */
  scroll?: boolean;
  children: ReactNode;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>{children}</View>
  );
  return (
    <>
      <ScreenHeader title={title} />
      <HeaderToolbar placement="right">
        {headerAction({
          action: 'done',
          onPress: onDone ?? closeSheet,
          t,
          ...(doneLabel ? { label: doneLabel } : {}),
          disabled: doneDisabled,
          variant: 'done',
          tint: theme.colors.accent,
        })}
      </HeaderToolbar>
      {scroll ? (
        <ScrollView
          style={{ backgroundColor: theme.colors.background }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ backgroundColor: theme.colors.background }}>{body}</View>
      )}
    </>
  );
}

/** Close whichever sheet is on top. A sheet is always presented over something to return to. */
export function closeSheet(): void {
  if (router.canGoBack()) router.back();
}

/** A titled group inside a form, e.g. "Reps" above its stepper. */
export const FormSection = memo(function FormSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Txt variant="micro" tone="faint" uppercase tracking={0.8} style={styles.flex}>
          {title}
        </Txt>
        {action}
      </View>
      {children}
      <View style={[styles.rule, { backgroundColor: theme.colors.hairline }]} />
    </View>
  );
});

/** A row of in-content actions at the end of a form (a destructive Remove, a secondary). */
export const FormFooter = memo(function FormFooter({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.footer, style]}>{children}</View>;
});

const styles = StyleSheet.create({
  body: { paddingHorizontal: screenGutter, paddingTop: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
