import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useCrossFade } from '@/features/core/design-system/animation/animation';
import { type BundledImage, BundledPhoto } from '@/features/core/design-system/display/BundledPhoto';

/**
 * Two frames of a movement as one picture: the end frame stacked over the start one and faded in
 * and out by `useCrossFade`, so the photo reads as the movement. It loops only while `active` and
 * there is an end frame; stopped, or with reduced motion on, the start frame shows. The pair is one
 * image to a screen reader, named once by `label`. The frame takes its size from `style`; each
 * frame shows its own blur until it decodes.
 */
export function CrossFadeImage({
  start,
  end,
  active,
  label,
  style,
  onError,
}: {
  start: BundledImage;
  end: BundledImage | null;
  active: boolean;
  label: string;
  style: StyleProp<ViewStyle>;
  onError?: () => void;
}) {
  const fade = useCrossFade(active && end !== null);
  return (
    <View style={style} accessible accessibilityRole="image" accessibilityLabel={label}>
      <BundledPhoto
        image={start}
        style={StyleSheet.absoluteFill}
        transition={220}
        {...(onError === undefined ? {} : { onError })}
      />
      {end !== null ? (
        <Animated.View style={[StyleSheet.absoluteFill, fade]} pointerEvents="none">
          <BundledPhoto image={end} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}
