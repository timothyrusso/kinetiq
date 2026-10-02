import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';
import { EXERCISE_IMAGE_CACHE } from '@/features/core/design-system/display/imageCache';

/**
 * A photo bundled with the app: the asset Metro hands back for its `require`, and the blurhash
 * drawn blurred until the photo decodes. The blurhash is a generated value, never computed here.
 */
export type BundledImage = {
  readonly asset: number;
  readonly blurhash?: string;
};

/**
 * The blur for a photo that has no blurhash of its own: one flat light grey, the backdrop of the
 * catalog's photos, so the photo lands on a tone it already has.
 */
const DEFAULT_BLURHASH = '00Q0XJ';

/**
 * Every bundled photo is drawn through here, so the blurred placeholder, the fade from it and the
 * cache policy are one decision rather than one per screen. The placeholder fills the frame as the
 * photo will (`cover`), so nothing shifts when the photo replaces it.
 */
export function BundledPhoto({
  image,
  style,
  transition,
  onError,
}: {
  image: BundledImage;
  style: StyleProp<ImageStyle>;
  transition?: number;
  onError?: () => void;
}) {
  return (
    <Image
      source={image.asset}
      placeholder={{ blurhash: image.blurhash ?? DEFAULT_BLURHASH }}
      placeholderContentFit="cover"
      style={style}
      contentFit="cover"
      {...(transition === undefined ? {} : { transition })}
      recyclingKey={String(image.asset)}
      cachePolicy={EXERCISE_IMAGE_CACHE}
      {...(onError === undefined ? {} : { onError })}
      accessibilityIgnoresInvertColors
    />
  );
}
