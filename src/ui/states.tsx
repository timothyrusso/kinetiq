/**
 * Loading, empty and error surfaces.
 *
 * The rule behind all of them: **a screen is never blank**. Every one of these has a
 * title that says what is missing, a line that says why it matters here, and: where
 * the user can act: the action. An error with no retry is a dead end, and a dead end
 * with no explanation reads as a broken app rather than a failed request.
 *
 * Skeletons are shaped like the content they stand in for. A grey box the same size as
 * a metric card means the layout will not jump when data arrives, which is the whole
 * point; a spinner in the middle of an empty page means everything moves twice.
 */
import { memo, useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme';
import { haptics } from '@/services/haptics';
import { isOfflineError } from '@/api';
import { useShimmer } from './animation';
import { Button } from './Button';
import { Icon, type IconName } from './icons';
import { Stack } from './layout';
import { Txt } from './Text';

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
export const SkeletonRow = memo(function SkeletonRow() {
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

export const SkeletonList = memo(function SkeletonList({ rows = 6 }: { rows?: number }) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLabel="Loading"
      style={{ paddingHorizontal: spacing.xl, gap: spacing.xs }}
    >
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
          paddingHorizontal: spacing.xxl,
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
        <Button
          label={actionLabel}
          onPress={() => {
            haptics.medium();
            onAction();
          }}
          variant={tone === 'danger' ? 'secondary' : 'primary'}
        />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Pressable
          onPress={() => {
            haptics.light();
            onSecondary();
          }}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Txt variant="label" tone="muted" style={{ textDecorationLine: 'underline' }}>
            {secondaryLabel}
          </Txt>
        </Pressable>
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
  const offline = isOfflineError(error);
  return (
    <StateScaffold
      icon={offline ? 'offline' : 'warning'}
      tone={offline ? 'warning' : 'danger'}
      title={
        title ??
        (offline
          ? 'You are offline'
          : isTimeoutLike(error)
            ? 'The server took too long'
            : 'Could not load this')
      }
      message={
        offline
          ? 'Anything you have saved is still here. Remote exercises and new images will come back as soon as you reconnect.'
          : 'This one did not respond. Trying again usually works.'
      }
      actionLabel="Try again"
      onAction={onRetry}
      style={style}
      compact={compact}
    />
  );
});

export const OfflineState = memo(function OfflineState({
  onRetry,
  style,
  compact = false,
}: {
  /**
   * Optional on purpose. A retry affordance that fires into nothing is worse than no
   * affordance, so callers that cannot retry (a tab with no query) omit it and get the
   * explanation alone.
   */
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  return (
    <StateScaffold
      icon="offline"
      tone="warning"
      title="No connection"
      message="Your routines, history and progress are stored on this device and are unaffected."
      {...(onRetry ? { actionLabel: 'Retry', onAction: onRetry } : {})}
      style={style}
      compact={compact}
    />
  );
});

/** Permission denials: what to do about it, not just that it happened. */
export const PermissionState = memo(function PermissionState({
  feature,
  message,
  actionLabel = 'Open settings',
  onAction,
  icon = 'lock',
  style,
}: {
  feature: string;
  message: string;
  actionLabel?: string;
  onAction: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <StateScaffold
      icon={icon}
      tone="warning"
      title={`${feature} is turned off`}
      message={message}
      actionLabel={actionLabel}
      onAction={onAction}
      style={style}
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
}: {
  refreshing: boolean;
  onRefresh: () => void;
  progressViewOffset?: number;
}) {
  const theme = useAppTheme();
  return useMemo(
    () => (
      <RefreshControl
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
    ),
    [onRefresh, progressViewOffset, refreshing, theme.colors.accent, theme.colors.surface],
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
