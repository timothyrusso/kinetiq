/**
 * Material glyphs rendered to images, for the Android APIs that only take an image source.
 *
 * Android's native header items and Compose icons draw a bitmap, not a font glyph, so every
 * Material icon those surfaces use is rendered once during bootstrap (overlapped with the font
 * load, before the navigator mounts) and read synchronously afterwards. Rendered in black: the
 * native side tints template images itself, so one render serves every theme.
 *
 * No-op off Android. Everywhere else, and in React Native content, icons are Ionicons.
 */
import { Platform, type ImageSourcePropType } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

const SIZE = 24;
const sources = new Map<MaterialIconName, ImageSourcePropType>();

export async function prefetchMaterialIcons(names: readonly MaterialIconName[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    [...new Set(names)].map(async (name) => {
      const source = await MaterialIcons.getImageSource(name, SIZE, '#000000').catch(() => null);
      if (source) sources.set(name, source);
    }),
  );
}

/** The rendered image, or undefined if it was never prefetched (or failed to render). */
export function materialIcon(name: MaterialIconName): ImageSourcePropType | undefined {
  return sources.get(name);
}
