/**
 * Loading, empty and error surfaces.
 *
 * The rule behind all of them: **a screen is never blank**. Every one of these has a
 * title that says what is missing, a line that says why it matters here, and, where
 * the user can act, the action. An error with no retry is a dead end, and a dead end
 * with no explanation reads as a broken app rather than a failed request.
 *
 * Skeletons are shaped like the content they stand in for. A grey box the same size as
 * a metric card means the layout will not jump when data arrives, which is the whole
 * point; a spinner in the middle of an empty page means everything moves twice.
 */
import { memo } from 'react';
import {
  RefreshControl,
  type RefreshControlProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { radius, screenGutter, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme';
import { haptics } from '@/services/haptics';
import { isOfflineError } from '@/api';
import { useShimmer } from './animation';
import { Button } from '@/ui/controls/Button';
import { Icon, type IconName } from './icons';
import { Stack } from '@/ui/layout';
import { Txt } from './Text';
import { useT } from '@/i18n/useT';

/**
 * Shimmering placeholder block. `width` may be a percentage string for fluid rows;
 * the shimmer then travels the measured track width passed to `useShimmer`.
 */
export const Skeleton = memo(function Skeleton({
  height = 16,
  width = '100%',
  radius: r = radius.sm,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const style_ = useShimmer(typeof width === 'number' ? width : 320);
  return (
    <View
      accessibilityElementsHidden
      style={[
        {
          height,
          width,
          borderRadius: r,
          backgroundColor: theme.colors.placeholder,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '40%',
            backgroundColor: theme.colors.surfaceRaised,
            opacity: 0.7,
          },
          style_,
        ]}
      />
    </View>
  );
});

/** Placeholder row shaped like an activity list row. */
const SkeletonRow = memo(function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <Skeleton height={44} width={44} radius={radius.md} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton height={14} width="62%" />
        <Skeleton height={11} width="38%" />
      </View>
      <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
        <Skeleton height={14} width={56} />
        <Skeleton height={11} width={40} />
      </View>
    </View>
  );
});

/** Placeholder block shaped like a metric card. */
export const SkeletonCard = memo(function SkeletonCard({
  lines = 2,
  style,
}: {
  lines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: spacing.md, padding: spacing.lg }, style]}>
      <Skeleton height={11} width="45%" />
      <Skeleton height={30} width="60%" />
      {lines > 1 ? <Skeleton height={11} width="80%" /> : null}
    </View>
  );
});

/**
 * Placeholder rows for a list that is loading.
 *
 * No gutter of its own: every caller already sits inside a container that owns the screen
 * gutter (rule 1.3, rows never self-pad), and a second one here drew the skeleton 40pt in from
 * the edge while the rows that replaced it sat at 20.
 */
export const SkeletonList = memo(function SkeletonList({ rows = 6 }: { rows?: number }) {
  const { t } = useT();
  const theme = useAppTheme();
  return (
    <View accessibilityLabel={t('misc.loading')} style={{ gap: spacing.xs }}>
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.hairline }}
        >
          <SkeletonRow />
        </View>
      ))}
    </View>
  );
});

type StateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  icon?: IconName;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The shared anatomy for every "nothing here" screen. */
function StateScaffold({
  icon,
  tone = 'neutral',
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
  style,
}: StateProps & { tone?: 'neutral' | 'danger' | 'warning' | 'accent' }) {
  const theme = useAppTheme();
  const tint =
    tone === 'danger'
      ? theme.colors.danger
      : tone === 'warning'
        ? theme.colors.warning
        : tone === 'accent'
          ? theme.colors.accent
          : theme.colors.textFaint;
  const tintSoft =
    tone === 'danger'
      ? theme.colors.dangerSoft
      : tone === 'warning'
        ? theme.colors.warningSoft
        : tone === 'accent'
          ? theme.colors.accentSoft
          : theme.colors.placeholder;

  return (
    <View
      accessibilityRole="summary"
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          gap: compact ? spacing.md : spacing.xxl,
          paddingHorizontal: screenGutter,
          paddingVertical: compact ? spacing.xxl : spacing.huge,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: compact ? 46 : 62,
            height: compact ? 46 : 62,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tintSoft,
          }}
        >
          <Icon name={icon} size={compact ? 22 : 28} color={tint} />
        </View>
      ) : null}
      <Stack gap="sm" style={{ alignItems: 'center', maxWidth: 320 }}>
        <Txt
          variant={compact ? 'subhead' : 'title'}
          align="center"
          // An announced heading is what makes a screen reader say "nothing here yet"
          // rather than reading a paragraph with no context.
          role="heading"
        >
          {title}
        </Txt>
        {message ? (
          <Txt variant="body" tone="muted" align="center">
            {message}
          </Txt>
        ) : null}
      </Stack>
      {actionLabel && onAction ? (
        // `Button` fires its own haptic: a second one here doubled every tap.
        <Button label={actionLabel} onPress={onAction} variant={tone === 'danger' ? 'secondary' : 'primary'} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        // The platform's text button (HIG plain, Material text), not an underlined link: a
        // link-styled line reads as navigation to somewhere else, and this is an action.
        <Button label={secondaryLabel} variant="quiet" onPress={onSecondary} />
      ) : null}
    </View>
  );
}

export const EmptyState = memo(function EmptyState(props: StateProps) {
  return (
    <StateScaffold
      {...props}
      icon={props.icon ?? 'listAdd'}
      // Empty is not an error. Saying so in the palette keeps a first-run app from
      // reading as a wall of warnings.
      tone="neutral"
    />
  );
});

/**
 * Maps an unknown throwable to the right failure screen and hands back the retry.
 * The offline/online distinction is the important one: telling someone "something went
 * wrong" while their plane mode is on is both untrue and unhelpful.
 */
export const ErrorState = memo(function ErrorState({
  error,
  onRetry,
  title,
  style,
  compact = false,
}: {
  error: unknown;
  onRetry: () => void;
  title?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const { t } = useT();
  const offline = isOfflineError(error);
  return (
    <StateScaffold
      icon={offline ? 'offline' : 'warning'}
      tone={offline ? 'warning' : 'danger'}
      title={
        title ??
        t(
          offline
            ? 'states.offlineTitle'
            : isTimeoutLike(error)
              ? 'states.timeoutTitle'
              : 'states.genericTitle',
        )
      }
      message={t(offline ? 'states.offlineMessage' : 'states.genericMessage')}
      actionLabel={t('common.retry')}
      onAction={onRetry}
      style={style}
      compact={compact}
    />
  );
});

/**
 * Pull-to-refresh, themed. Android ignores `tintColor` in favour of `colors` and needs
 * both supplied, or the spinner stays the OS default grey on one of the two platforms.
 */
export function ThemedRefreshControl({
  refreshing,
  onRefresh,
  progressViewOffset,
  ...forwarded
}: Omit<RefreshControlProps, 'refreshing' | 'onRefresh'> & {
  refreshing: boolean;
  onRefresh: () => void;
  progressViewOffset?: number;
}) {
  const theme = useAppTheme();
  // Everything else is forwarded, children included, and that is load-bearing on Android: a
  // ScrollView there renders INSIDE its refresh control (React Native clones the element and
  // hands it the list as a child). A wrapper that dropped its children rendered every
  // FlashList screen blank on Android, while iOS, which nests the control the other way
  // round, looked fine.
  return (
    <RefreshControl
      {...forwarded}
      refreshing={refreshing}
      onRefresh={() => {
        haptics.light();
        onRefresh();
      }}
      tintColor={theme.colors.accent}
      colors={[theme.colors.accent]}
      progressBackgroundColor={theme.colors.surface}
      {...(progressViewOffset === undefined ? {} : { progressViewOffset })}
    />
  );
}

/**
 * Distinguishes a slow-failure (504 / gateway / timeout wording) from a generic one.
 * Deliberately conservative: a wrong "too long" message is still an explanation, but a
 * wrong "you are offline" is a lie about the user's own device.
 */
function isTimeoutLike(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /timeout|timed out|gateway|504|ETIMEDOUT|ENETWORK/i.test(message);
}
