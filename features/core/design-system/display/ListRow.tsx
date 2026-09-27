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
import { memo } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { MetaLine } from '@/features/core/design-system/display/MetaLine';
import { TagRow } from '@/features/core/design-system/display/TagRow';
import type { MetaItem, Tag } from '@/features/core/design-system/display/types';
import { Icon } from '@/features/core/design-system/icons/icons';
import { CellText } from '@/features/core/design-system/text/CellText';
import { screenGutter, spacing, type Theme } from '@/features/core/theme';

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
  descriptionLines = 2,
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
  /** How many lines the description may take before it truncates. */
  descriptionLines?: number;
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
            pressed && interactive ? theme.colors.surfacePressed : selected ? theme.colors.accentSoft : 'transparent',
        },
        style,
      ]}
    >
      <View style={ROW}>
        {leading}
        <View style={{ flex: 1, gap: 3 }}>
          <CellText text={title} variant="subhead" weight="600" color={theme.colors.text} numberOfLines={2} />
          {description ? (
            <CellText
              text={description}
              variant="caption"
              color={theme.colors.textMuted}
              numberOfLines={descriptionLines}
            />
          ) : null}
          {meta && meta.length > 0 ? <MetaLine items={meta} theme={theme} wrap /> : null}
          {tags && tags.length > 0 ? (
            <TagRow tags={tags} theme={theme} {...(tagsMax === undefined ? {} : { max: tagsMax })} />
          ) : null}
        </View>
        {body}
        {trailing}
        {showChevron ? (
          <Icon name="chevronRight" size={17} color={theme.colors.textFaint} style={{ marginLeft: spacing.sm }} />
        ) : null}
      </View>
      {bottomAccessory ? <View style={{ paddingTop: spacing.md }}>{bottomAccessory}</View> : null}
    </Pressable>
  );
});
