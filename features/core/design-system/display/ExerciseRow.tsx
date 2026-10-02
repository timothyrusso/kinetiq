import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BundledImage } from '@/features/core/design-system/display/BundledPhoto';
import { ExerciseThumb } from '@/features/core/design-system/display/ExerciseThumb';
import { ListRow } from '@/features/core/design-system/display/ListRow';
import type { Tag } from '@/features/core/design-system/display/types';
import { CellText } from '@/features/core/design-system/text/CellText';
import { radius, spacing, type Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

/**
 * A catalog exercise as a row.
 *
 * `tags` arrive built for the same reason `ActivityRow`'s subtitle does: which of muscles, body
 * area and equipment deserves the line depends on what the exercise has, and a stored copy may
 * have none of them, so a row guessing on its own would print an empty line. The caller decides.
 *
 * `dimmed` is for `keepPreviousData`: rows still on screen belong to the *previous* query
 * while a new one is in flight. Dimming says "these are about to change"; leaving them
 * bright claims they are already the answer.
 */
export const ExerciseRow = memo(function ExerciseRow({
  name,
  image,
  tags,
  badge,
  theme,
  onPress,
  dimmed = false,
  topDivider = true,
}: {
  name: string;
  /** The bundled thumbnail, as `ExerciseThumb` takes it. */
  image: BundledImage | null;
  /** Primary muscles first, capped at two with "+n": a row stays one line tall. */
  tags: readonly Tag[];
  /** A status-style pill opposite the title: the exercise's category on the Exercises tab. */
  badge?: string;
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
        // NOTE: A whole-row opacity rather than per-text colour: the thumbnail has to dim with
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
        leading={<ExerciseThumb source={image} name={name} size={48} theme={theme} />}
        {...(badge ? { body: <RowBadge label={badge} theme={theme} /> } : {})}
      />
    </View>
  );
});

/**
 * `Badge`, drawn the row way: theme as a prop and `CellText`, so a row that
 * shows one does not become a theme subscriber.
 */
const RowBadge = memo(function RowBadge({ label, theme }: { label: string; theme: Theme }) {
  return (
    <View
      style={{
        alignSelf: 'center',
        maxWidth: 120,
        backgroundColor: theme.colors.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
      }}
    >
      <CellText
        text={label.toLocaleUpperCase()}
        variant="micro"
        weight="700"
        color={theme.colors.accent}
        numberOfLines={1}
      />
    </View>
  );
});
