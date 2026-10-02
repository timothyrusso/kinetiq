import type { BundledImage } from '@/features/core/design-system';
import { CATALOG_IMAGES } from '@/features/exercises/mappers/catalogImages.generated';

/** A bundled photo's asset path: `assets/catalog/images/<slug>/<frame>.webp`. */
const BUNDLED_PATH = /^assets\/catalog\/images\/([a-z0-9-]+)\/(0|1|thumb)\.webp$/;

const FRAME = { '0': 'start', '1': 'end', thumb: 'thumb' } as const;

/**
 * The bundled image a stored asset path names, with its blurhash, as the design system draws it,
 * or null for a path this build does not bundle: a retired exercise whose photos left with it, an
 * exercise still waiting for its photos, and any URL an older copy stored. Null draws the fallback
 * plaque. Resolved at render time, because what Metro hands back is a module number that changes
 * between builds. The entry is the map's own object, so it is the same reference on every call.
 */
export function exerciseImageSource(path: string | null): BundledImage | null {
  const match = path === null ? null : BUNDLED_PATH.exec(path);
  if (!match) return null;
  const [, slug = '', frame = 'thumb'] = match;
  return CATALOG_IMAGES[slug]?.[FRAME[frame as keyof typeof FRAME]] ?? null;
}
