/**
 * List-row primitives.
 *
 * These render hundreds of times, so they are written differently from the rest of
 * the kit on purpose: **none of them read the theme from context.** Colours arrive
 * as a `theme` prop from the screen that owns the list, which already has it. A row
 * that called `useAppTheme()` would turn an appearance toggle into a re-render of
 * every visible row, and would make each row a context consumer that list recycling
 * cannot skip.
 *
 * Same discipline for text: rows use `CellText`, which composes the same font tokens
 * as `Txt` without the context read. Typography is shared; subscription is not.
 *
 * Press feedback here is a background change, not a scale transform. In a scrolling
 * list a transform on the row fights the scroll performance it is competing with,
 * and a tinted row reads as promptly as a shrinking one.
 */
import { memo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import type { Activity, ActivityKind, ExerciseSnapshot, Routine } from '@/domain/types';
import { haptics } from '@/services/haptics';
import { radius, screenGutter, spacing, touchTarget } from '@/theme/tokens';
import { useAppTheme, type Theme } from '@/theme/theme';
import { AnimatedPressable, usePressScale } from './animation';
import { Icon, IconTile, type IconName } from './icons';
import { Txt } from './Text';
import { CellText } from './CellText';
import { MetaLine } from './display/MetaLine';
import { TagRow } from './display/TagRow';
import type { MetaItem, Tag } from './display/types';
import { tr } from '@/i18n/tr';
import { useT } from '@/i18n/useT';

/** Activity kind → glyph. One table, so a kind can never render the wrong icon. */
export const ACTIVITY_ICON: Record<ActivityKind, IconName> = {
  run: 'run',
  ride: 'bike',
  lift: 'dumbbell',
  walk: 'walk',
  yoga: 'yoga',
};

const ROW: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: spacing.md };

/**
 * Generic two-line cell: leading element, title + subtitle, trailing content.
 *
 * Nearly everything the app lists is a variation of this, so the variation is
 * expressed as slots rather than as four near-duplicate components that drift.
 */
export const ListRow = memo(function ListRow({
  title,
  description,
  meta,
  tags,
  tagsMax,
  theme,
  leading,
  trailing,
  onPress,
  onLongPress,
  selected = false,
  disabled = false,
  showChevron = false,
  bottomAccessory,
  body,
  style,
  accessibilityHint,
}: {
  title: string;
  /**
   * A sentence about the row, for rows that are links (Profile's "Settings, units..."). Prose,
   * not metadata: facts about the thing go in `meta` and `tags`, never joined into a string.
   */
  description?: string;
  meta?: readonly MetaItem[];
  tags?: readonly Tag[];
  /** Tags shown before the rest collapse into "+n". */
  tagsMax?: number;
  theme: Theme;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
  /** Full-width second tier: a chip row, a mini chart, a stepper. */
  bottomAccessory?: React.ReactNode;
  /** Right-column body, replacing nothing: sits opposite the title block. */
  body?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const interactive = onPress !== undefined;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || !interactive}
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      {...(disabled ? { accessibilityState: { disabled: true } } : {})}
      style={({ pressed }) => [
        {
          paddingHorizontal: screenGutter,
          paddingVertical: spacing.md,
          backgroundColor:
            pressed && interactive
              ? theme.colors.surfacePressed
              : selected
                ? theme.colors.accentSoft
                : 'transparent',
        },
        style,
      ]}
    >
      <View style={ROW}>
        {leading}
        <View style={{ flex: 1, gap: 3 }}>
          <CellText
            text={title}
            variant="subhead"
            weight="600"
            color={theme.colors.text}
            numberOfLines={2}
          />
          {description ? (
            <CellText
              text={description}
              variant="caption"
              color={theme.colors.textMuted}
              numberOfLines={2}
            />
          ) : null}
          {meta && meta.length > 0 ? <MetaLine items={meta} theme={theme} /> : null}
          {tags && tags.length > 0 ? (
            <TagRow tags={tags} theme={theme} {...(tagsMax === undefined ? {} : { max: tagsMax })} />
          ) : null}
        </View>
        {body}
        {trailing}
        {showChevron ? (
          <Icon
            name="chevronRight"
            size={17}
            color={theme.colors.textFaint}
            style={{ marginLeft: spacing.sm }}
          />
        ) : null}
      </View>
      {bottomAccessory ? (
        <View style={{ paddingTop: spacing.md }}>{bottomAccessory}</View>
      ) : null}
    </Pressable>
  );
});

/**
 * Navigation cell for the settings list: title, optional subtitle, an optional
 * right-aligned *value* ("Kilometres"), then the chevron.
 *
 * The value is a separate slot from `trailing` because they mean different things:
 * a value is the current state of a setting, `trailing` is a control. Putting a
 * switch where a value goes is how a list starts reading inconsistently.
 */
export const NavRow = memo(function NavRow({
  title,
  description,
  value,
  theme,
  onPress,
  icon,
  danger = false,
  showChevron = true,
  topDivider = true,
}: {
  title: string;
  description?: string;
  /** Current value, e.g. "Metric", "90 s", "Athlete". */
  value?: string;
  theme: Theme;
  onPress: () => void;
  icon?: IconName;
  danger?: boolean;
  showChevron?: boolean;
  topDivider?: boolean;
}) {
  return (
    <ListRow
      theme={theme}
      title={title}
      {...(description ? { description } : {})}
      onPress={onPress}
      showChevron={showChevron}
      style={
        topDivider
          ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline }
          : undefined
      }
      {...(icon
        ? {
            leading: (
              <IconTile
                name={icon}
                color={danger ? theme.colors.danger : theme.colors.textMuted}
                background={danger ? theme.colors.dangerSoft : theme.colors.placeholder}
                size={30}
              />
            ),
          }
        : {})}
      {...(value
        ? {
            body: (
              <CellText
                text={value}
                variant="label"
                color={theme.colors.textMuted}
                numberOfLines={1}
                align="right"
                style={{ maxWidth: 150 }}
              />
            ),
          }
        : {})}
    />
  );
});

/** Activity row: the shape the Activities tab is measured in. */
export const ActivityRow = memo(function ActivityRow({
  activity,
  theme,
  onPress,
  onLongPress,
  headline,
  meta,
  selected = false,
  trailing,
}: {
  activity: Activity;
  theme: Theme;
  onPress: () => void;
  onLongPress?: () => void;
  /**
   * Right-column readout ("5.21 km"), built by the caller. Formatting is the
   * screen's job: it depends on unit settings *and* on which metrics are meaningful
   * for this kind, so a row that guessed would be wrong half the time.
   */
  headline: string;
  meta: readonly MetaItem[];
  selected?: boolean;
  /** Overrides the chevron, e.g. a PR badge or a swipe-action affordance. */
  trailing?: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <ListRow
      theme={theme}
      title={activity.title}
      meta={meta}
      selected={selected}
      onPress={onPress}
      {...(onLongPress ? { onLongPress } : {})}
      accessibilityHint={t('misc.opensWorkout')}
      leading={
        <IconTile
          name={ACTIVITY_ICON[activity.kind]}
          color={theme.colors.tone[activity.kind]}
          background={theme.colors.toneSoft[activity.kind]}
        />
      }
      body={
        <CellText
          text={headline}
          variant="numeralSm"
          color={theme.colors.text}
          align="right"
        />
      }
      {...(trailing ? { trailing } : { showChevron: false })}
    />
  );
});

/** Routine row. Its metadata is the routine's volume and history, not its description. */
export const RoutineRow = memo(function RoutineRow({
  routine,
  theme,
  onPress,
  onLongPress,
  meta,
  trailing,
  topDivider = true,
}: {
  routine: Routine;
  theme: Theme;
  onPress: () => void;
  onLongPress?: () => void;
  meta: readonly MetaItem[];
  trailing?: React.ReactNode;
  topDivider?: boolean;
}) {
  const { t } = useT();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${routine.name}. ${meta.map((m) => m.a11y ?? m.label).join(', ')}`}
      accessibilityHint={t('misc.opensRoutine')}
      style={({ pressed }) => [
        {
          paddingHorizontal: screenGutter,
          paddingVertical: spacing.lg,
          gap: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          borderTopWidth: topDivider ? StyleSheet.hairlineWidth : 0,
          borderTopColor: theme.colors.hairline,
          backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
        },
      ]}
    >
      <IconTile name="layers" color={theme.colors.accent} background={theme.colors.accentSoft} />
      <View style={{ flex: 1, gap: 4 }}>
        <CellText
          text={routine.name}
          variant="subhead"
          weight="600"
          color={theme.colors.text}
          numberOfLines={1}
        />
        <MetaLine items={meta} theme={theme} />
      </View>
      {trailing ?? <Icon name="play" size={18} color={theme.colors.accent} />}
    </Pressable>
  );
});

/**
 * Square exercise thumbnail with a graceful absence.
 *
 * A large share of wger exercises have no image at all, so "no image" is one of the
 * layouts rather than an error to apologise for. The initials tile is exactly the
 * size of the image it replaces, so a list does not reflow as art lands.
 */
export const ExerciseThumb = memo(function ExerciseThumb({
  uri,
  name,
  size = 48,
  theme,
  rounded = radius.md,
}: {
  uri: string | null;
  name: string;
  size: number;
  theme: Theme;
  rounded?: number;
}) {
  const [failed, setFailed] = useState(false);
  const shared = {
    width: size,
    height: size,
    borderRadius: rounded,
    backgroundColor: theme.colors.placeholder,
  } as const;
  if (!uri || failed) {
    return (
      <View
        style={[shared, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}
        accessibilityElementsHidden
      >
        <CellText
          text={initials(name)}
          variant="label"
          weight="700"
          color={theme.colors.textFaint}
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={shared}
      contentFit="cover"
      transition={180}
      recyclingKey={uri}
      // Without this a 404 leaves a square the exact colour of the background,
      // which reads as "the app broke" rather than "this exercise has no picture".
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
});

/**
 * Monogram avatar for Profile. No photo: there is no camera flow in scope, and a
 * stock face would be the one element in the app that is obviously not the user.
 */
export const Avatar = memo(function Avatar({
  name,
  theme,
  size = 40,
  style,
}: {
  name: string;
  theme: Theme;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.secondarySoft,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
        },
        style,
      ]}
      role="img"
      accessibilityLabel={name}
    >
      <CellText
        text={initials(name)}
        variant="subhead"
        weight="700"
        color={theme.colors.text}
      />
    </View>
  );
});

/** Two-letter monogram. "Adrian Russo" → "AR", "athlete" → "A". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const out = `${first}${last}`.toUpperCase();
  // An empty monogram renders as an empty circle; a dash says "no name set".
  return out.length > 0 ? out : ', ';
}

/**
 * A catalog row from the remote exercise provider.
 *
 * `subtitle` arrives pre-formatted for the same reason `ActivityRow`'s does: which of
 * muscles, category and equipment deserves the line depends on what the provider actually
 * filled in for that exercise, and wger leaves several of those empty often enough that a
 * row guessing on its own would print a lonely separator. The caller decides.
 *
 * `dimmed` is for `keepPreviousData`: rows still on screen belong to the *previous* query
 * while a new one is in flight. Dimming says "these are about to change"; leaving them
 * bright claims they are already the answer.
 */
export const ExerciseRow = memo(function ExerciseRow({
  name,
  uri,
  tags,
  theme,
  onPress,
  dimmed = false,
  topDivider = true,
}: {
  name: string;
  uri: string | null;
  /** Primary muscles first, capped at two with "+n": a row stays one line tall. */
  tags: readonly Tag[];
  theme: Theme;
  onPress: () => void;
  dimmed?: boolean;
  topDivider?: boolean;
}) {
  const { t } = useT();
  return (
    <View
      style={{
        borderTopWidth: topDivider ? StyleSheet.hairlineWidth : 0,
        borderTopColor: theme.colors.hairline,
        // A whole-row opacity rather than per-text colour: the thumbnail has to dim with
        // the words, and three faded colours never match the one number.
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <ListRow
        theme={theme}
        title={name}
        tags={tags}
        tagsMax={2}
        onPress={onPress}
        showChevron
        accessibilityHint={t('misc.opensExercise')}
        leading={<ExerciseThumb uri={uri} name={name} size={48} theme={theme} />}
      />
    </View>
  );
});

/** Up to `max` names, comma-separated, then "+n". */
export function summarizeExerciseNames(names: string[], max = 3): string {
  if (names.length === 0) return tr('states.noExercisesYet');
  const rest = names.length - max;
  const head = names.slice(0, Math.max(1, max)).join(', ');
  return rest > 0 ? `${head} +${rest}` : head;
}

/** The best available image for a snapshot: thumb first, art second. */
export function thumbUriOf(snapshot: ExerciseSnapshot): string | null {
  return snapshot.thumbnailUrl ?? snapshot.imageUrl;
}

/**
 * A full-width row that behaves like a button: a list cell, a settings item. Kept
 * separate from `Button` because its anatomy is different (title + supporting text
 * + trailing accessory) and because it must not inherit button skin.
 */
export const ActionRow = memo(function ActionRow({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  tone = 'default',
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  trailing?: React.ReactNode;
  onPress: (e: GestureResponderEvent) => void;
  tone?: 'default' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const scale = usePressScale(0.995);
  const color = tone === 'danger' ? theme.colors.danger : theme.colors.text;

  return (
    <AnimatedPressable
      onPress={(e: GestureResponderEvent) => {
        haptics.light();
        onPress(e);
      }}
      onPressIn={scale.onPressIn}
      onPressOut={scale.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          minHeight: touchTarget,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: theme.colors.surface,
        },
        scale.style,
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone === 'danger' ? theme.colors.dangerSoft : theme.colors.placeholder,
          }}
        >
          <Icon name={icon} size={18} color={color} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyLg" weight="semibold" color={color} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing ?? <Icon name="chevronRight" size={18} color={theme.colors.textFaint} />}
    </AnimatedPressable>
  );
});

export type ListRowProps = React.ComponentProps<typeof ListRow>;
