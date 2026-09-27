import { memo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '@/theme/theme';
import { radius, screenGutter, spacing, z } from '@/theme/tokens';
import { formatTimer } from '@/utils/format';
import { IconButton } from '@/ui/controls/IconButton';
import { Row } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { useT } from '@/i18n/useT';

/**
 * The rest-timer dock.
 *
 * Pinned to the bottom of the window rather than left in the scroll: a timer that scrolls
 * off-screen is a timer that gets forgotten, and the entire point of a countdown is that
 * you stop watching it. Drag-to-dismiss is deliberately absent: this floats over set rows,
 * and a sheet-style pan here would swallow taps on whatever sat underneath.
 *
 * The bar is a determinate linear track, not a ring. A ring needs an SVG arc for an honest
 * sweep, and a `borderWidth` fake sweeps wrong in the last quarter of every timer.
 */
export const RestDock = memo(function RestDock({
  remainingSeconds,
  totalSeconds,
  theme,
  onSkip,
  onAdjust,
  onHeight,
}: {
  remainingSeconds: number;
  totalSeconds: number;
  theme: Theme;
  onSkip: () => void;
  onAdjust: (seconds: number) => void;
  /** The dock's own height, so the scroll view behind it can leave room for it. */
  onHeight?: (height: number) => void;
}) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / totalSeconds)) : 0;

  return (
    <View
      style={[styles.dock, { bottom: insets.bottom + spacing.md }]}
      pointerEvents="box-none"
      onLayout={
        onHeight
          ? (e: LayoutChangeEvent) => {
              onHeight(Math.round(e.nativeEvent.layout.height));
            }
          : undefined
      }
    >
      <Row
        gap="md"
        align="center"
        style={[
          styles.dockCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
            borderRadius: theme.surfaceSkin.radius,
          },
          theme.shadows.raised,
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row gap="sm" align="center">
            <Txt variant="micro" uppercase tracking={0.8} weight="700" tone="muted">
              {t('misc.rest')}
            </Txt>
            <Txt
              variant="monoLg"
              weight="700"
              tone="accent"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatTimer(remainingSeconds)}
            </Txt>
          </Row>
          <View style={[styles.track, { backgroundColor: theme.colors.placeholder }]}>
            <View
              style={{
                height: '100%',
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: theme.colors.accent,
                borderRadius: radius.pill,
              }}
            />
          </View>
        </View>

        <View style={styles.adjust}>
          <IconButton
            name="minus"
            variant="surface"
            size={18}
            accessibilityLabel={t('setRow.restLess')}
            onPress={() => {
              onAdjust(Math.max(0, remainingSeconds - 15));
            }}
          />
          <IconButton
            name="plus"
            variant="surface"
            size={18}
            accessibilityLabel={t('setRow.restMore')}
            onPress={() => {
              onAdjust(Math.min(600, remainingSeconds + 15));
            }}
          />
        </View>

        <IconButton
          name="close"
          variant="plain"
          size={20}
          accessibilityLabel={t('setRow.skipRest')}
          onPress={onSkip}
        />
      </Row>
    </View>
  );
});

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: screenGutter, right: screenGutter, zIndex: z.sticky },
  dockCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  track: { height: 4, borderRadius: radius.pill, marginTop: spacing.sm, overflow: 'hidden' },
  adjust: { flexDirection: 'row', gap: spacing.xs },
} satisfies Record<string, ViewStyle>);
