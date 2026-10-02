import { Image } from 'expo-image';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useCrossFade } from '@/features/core/design-system/animation/animation';
import { EXERCISE_IMAGE_CACHE } from '@/features/core/design-system/display/imageCache';

/**
 * Two frames of a movement as one picture: the end frame stacked over the start one and faded in
 * and out by `useCrossFade`, so the photo reads as the movement. It loops only while `active` and
 * there is an end frame; stopped, or with reduced motion on, the start frame shows. The pair is one
 * image to a screen reader, named once by `label`. The frame takes its size from `style`.
 */
export function CrossFadeImage({
  start,
  end,
  active,
  label,
  style,
  onError,
}: {
  start: number;
  end: number | null;
  active: boolean;
  label: string;
  style: StyleProp<ViewStyle>;
  onError?: () => void;
}) {
  const fade = useCrossFade(active && end !== null);
  return (
    <View style={style} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Image
        source={start}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={220}
        recyclingKey={String(start)}
        cachePolicy={EXERCISE_IMAGE_CACHE}
        {...(onError === undefined ? {} : { onError })}
        accessibilityIgnoresInvertColors
      />
      {end !== null ? (
        <Animated.View style={[StyleSheet.absoluteFill, fade]} pointerEvents="none">
          <Image
            source={end}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            recyclingKey={String(end)}
            cachePolicy={EXERCISE_IMAGE_CACHE}
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
