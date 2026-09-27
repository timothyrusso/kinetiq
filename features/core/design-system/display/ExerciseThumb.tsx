import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { View } from 'react-native';
import { EXERCISE_IMAGE_CACHE } from '@/features/core/design-system/display/imageCache';
import { CellText } from '@/features/core/design-system/text/CellText';
import { radius, type Theme } from '@/features/core/theme';

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
        <CellText text={initials(name)} variant="label" weight="700" color={theme.colors.textFaint} />
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
      cachePolicy={EXERCISE_IMAGE_CACHE}
      // NOTE: Without this a 404 leaves a square the exact colour of the background,
      // which reads as "the app broke" rather than "this exercise has no picture".
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
});

/** Two-letter monogram. "Adrian Russo" → "AR", "athlete" → "A". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const out = `${first}${last}`.toUpperCase();
  // NOTE: An empty monogram renders as an empty circle; a hyphen says "no name set".
  return out.length > 0 ? out : '-';
}
