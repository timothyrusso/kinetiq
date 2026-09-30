/**
 * The body of a form-sheet route: the native sheet's header, and the column under it.
 *
 * Editors are routes presented as the platform's own sheet (`presentation: 'formSheet'`, with
 * a grabber and detents), not a sheet drawn in JavaScript. The sheet's header is a native
 * header like any other screen's: a title, and the confirming action as a text button in the
 * trailing slot. A screen that is a form reads its input from route params and writes through
 * the stores and queries the rest of the app already uses; it never receives a callback.
 *
 * The title and the confirming action are drawn here, inside the sheet, rather than in the
 * native header. Android's form sheet has no header at all (react-native-screens does not
 * draw one there), so the title and the only Save button vanished; and on iOS a `fit` body
 * cannot be inset by a header it cannot measure, so the header sat over the first field.
 *
 * `fit` bodies are plain views so a `fitToContents` detent can measure them. Taller editors
 * scroll; a sheet whose body is a long list uses `FormSheetList` instead, so the list is the
 * sheet's only scroll container.
 */

import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, type ReactElement, type ReactNode, useMemo } from 'react';
import { ScrollView, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/features/core/design-system/controls/Button';
import { Txt } from '@/features/core/design-system/text/Text';
import { screenGutter, spacing, useAppTheme } from '@/features/core/theme';
import type { TKey } from '@/features/core/translations';
import { useT } from '@/features/core/translations';

interface FormSheetBarProps {
  title: string;
  /** The trailing text action. Defaults to closing the sheet under the label "Done". */
  doneLabel?: TKey;
  onDone?: () => void;
  doneDisabled?: boolean;
}

export function FormSheet({
  scroll = false,
  children,
  ...barProps
}: FormSheetBarProps & {
  /** For bodies taller than a phone's half height. */
  scroll?: boolean;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bar = <FormSheetBar {...barProps} />;
  const body = <View style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>{children}</View>;
  return (
    <>
      {scroll ? (
        <ScrollView
          // NOTE: Android's sheet (Material's BottomSheetBehavior) only yields a drag to a child
          // with nested scrolling on; without it every downward drag moved the sheet, so the list
          // could not scroll back up. At the top of the list a drag still moves the sheet.
          nestedScrollEnabled
          style={{ backgroundColor: theme.colors.background }}
          contentContainerStyle={styles.gutter}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          {bar}
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.gutter, { backgroundColor: theme.colors.background }]}>
          {bar}
          {body}
        </View>
      )}
    </>
  );
}

/**
 * A form sheet whose body is a long list: the title bar and `header` scroll away as the list's
 * header and `footer` follows its last row, so a `FlashList` is the sheet's only scroll
 * container. A virtualised list inside the `scroll` body would be two scroll containers fighting
 * over one gesture, and would render every row anyway.
 */
export function FormSheetList<T>({
  header,
  footer,
  data,
  renderItem,
  keyExtractor,
  empty,
  ...barProps
}: FormSheetBarProps & {
  /** Everything above the rows: the search, the filters. Scrolls with them. */
  header: ReactNode;
  /** Below the last row, e.g. a Load more. */
  footer?: ReactNode;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  /** Drawn in place of the rows while there are none: a skeleton, an error, an empty state. */
  empty: ReactElement;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const contentContainerStyle = useMemo(
    () => ({ paddingHorizontal: screenGutter, paddingBottom: insets.bottom + spacing.lg }),
    [insets.bottom],
  );
  return (
    <FlashList
      // NOTE: the list is the sheet's scrolling child, so it carries the nested scrolling that
      // Android's sheet needs before it yields a drag (see `FormSheet`).
      nestedScrollEnabled
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={
        <>
          <FormSheetBar {...barProps} />
          <View style={[styles.body, styles.listHeader]}>{header}</View>
        </>
      }
      ListFooterComponent={footer ? <View style={[styles.body, styles.listFooter]}>{footer}</View> : null}
      ListEmptyComponent={empty}
    />
  );
}

function FormSheetBar({ title, doneLabel, onDone, doneDisabled = false }: FormSheetBarProps) {
  const { t } = useT();
  return (
    <View style={styles.bar}>
      <Txt variant="subhead" weight="600" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
        {title}
      </Txt>
      <Button
        label={t(doneLabel ?? 'headerActions.done')}
        onPress={onDone ?? closeSheet}
        disabled={doneDisabled}
        size="sm"
      />
    </View>
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
  gutter: { paddingHorizontal: screenGutter },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  body: { paddingTop: spacing.lg, gap: spacing.xl },
  listHeader: { paddingBottom: spacing.xl },
  listFooter: { paddingTop: spacing.xl },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
