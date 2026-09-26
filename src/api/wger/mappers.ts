/**
 * DTO → catalog mapping for wger responses.
 *
 * The interesting problem is language: `translations[]` arrives in *every* language when no
 * `language__code` filter is sent, and wger does not order them by preference, so
 * `translations[0]` is a coin flip (for exercise 73 it is German). Each translation is picked by
 * its explicit language id, and a missing one stays missing rather than being borrowed from
 * another language.
 *
 * Nothing here synthesises a value: a missing image, video or description stays null, and the
 * UI has a designed state for each.
 */
import { remoteExerciseId } from '@/domain/exerciseId';
import type { CatalogExercise, CatalogLanguage, CatalogPayload } from '@/catalog/types';
import type { WgerExerciseInfo, WgerImage, WgerLanguage, WgerMuscle, WgerNamedEntity, WgerTranslation } from './dto';

const BLOCK_CLOSE = /<\/(p|div|li|ul|ol|br|h[1-6])>/gi;
const BLOCK_OPEN = /<(p|div|li|ul|ol|h[1-6])[^>]*>/gi;

/**
 * Turns wger's `description` HTML into readable plain text for a `Text` node.
 *
 * No HTML renderer dependency: these descriptions are short instruction prose,
 * and a list of bullets reads better in a native sheet than a WebView. `<li>`
 * becomes a bullet line, block boundaries become newlines, everything else is
 * stripped.
 */
function htmlToPlainText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(BLOCK_CLOSE, '\n')
    .replace(BLOCK_OPEN, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 0 ? text : null;
}

/** Drops markdown emphasis and turns `* item` lines into bullets. */
function markdownToPlainText(source: string): string | null {
  const text = source
    .replace(/\*[ \t]*([^*]+)[ \t]*\*/g, '$1')
    .replace(/^[ \t]*[*-][ \t]+/gm, '• ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 0 ? text : null;
}

/**
 * Instruction prose. `description_source` is the author's own plain text and
 * survives a lossy round trip better than the HTML, so it wins when present;
 * we fall back to converting the HTML, and to null rather than guessing.
 */
function resolveInstructions(
  translation: WgerTranslation | null,
  notes: readonly string[],
): string | null {
  const fromSource = translation?.description_source?.trim()
    ? markdownToPlainText(translation.description_source)
    : null;
  const body = fromSource ?? htmlToPlainText(translation?.description);
  if (notes.length === 0) return body;
  const tail = notes.map((note) => `Note: ${note}`).join('\n');
  return body ? `${body}\n\n${tail}` : tail;
}

/**
 * Chooses the art to show. `is_main` is the author's own pick, so it wins;
 * otherwise the first image. `medium` thumbnails are preferred for both slots
 * because the full `image` is often a large scan while the thumbnail variants
 * are consistently sized: and 400px covers a detail header on a phone.
 */
function pickImages(images: readonly WgerImage[] | null | undefined): {
  imageUrl: string | null;
  thumbnailUrl: string | null;
} {
  const usable = (images ?? []).filter((i) => typeof i.image === 'string' && i.image.length > 0);
  const main = usable.find((i) => i.is_main === true) ?? usable[0];
  if (!main) return { imageUrl: null, thumbnailUrl: null };
  const small = main.thumbnails?.small ?? null;
  const medium = main.thumbnails?.medium ?? null;
  return {
    imageUrl: medium ?? main.image,
    thumbnailUrl: small ?? medium ?? main.image,
  };
}

/** HEVC cannot be assumed to decode on Android; surface it and let the UI omit video. */
function pickVideo(
  videos: readonly { video: string; is_main?: boolean; codec?: string | null }[] | null | undefined,
): string | null {
  const usable = (videos ?? []).filter((v) => typeof v.video === 'string' && v.video.length > 0);
  const main = usable.find((v) => v.is_main === true) ?? usable[0];
  if (!main) return null;
  const codec = (main.codec ?? '').toLowerCase();
  if (codec && codec !== 'h264' && codec !== 'avc') return null;
  return main.video;
}

export function mapLanguageCodes(languages: readonly WgerLanguage[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const language of languages) {
    const code = (language.short_name ?? '').trim().toLowerCase();
    if (code) map.set(language.id, code);
  }
  return map;
}

type Taxonomy = Pick<CatalogPayload, 'categories' | 'equipment' | 'muscles'>;

/** Categories and equipment share one shape. */
export function mapNamedEntities(entities: readonly WgerNamedEntity[]): { id: number; name: string }[] {
  return entities.map((e) => ({ id: e.id, name: e.name.trim() || `#${e.id}` }));
}

export function mapMuscles(muscles: readonly WgerMuscle[]): Taxonomy['muscles'] {
  return muscles.map((m) => ({
    id: m.id,
    name: m.name.trim() || `#${m.id}`,
    nameEn: m.name_en?.trim() || null,
    isFront: m.is_front !== false,
  }));
}

/**
 * wger's prose uses em and en dashes, which this app does not ship (see CLAUDE.md). A dash
 * between two numbers is a range and becomes a hyphen; any other becomes a colon, which reads
 * correctly in every case the catalog has ("tucked in tight: do not let them flare out").
 * Written as escapes because the dash check scans this file too.
 */
function withoutDashes(text: string): string {
  return text.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1-$2').replace(/\s*[\u2013\u2014]\s*/g, ': ');
}

function translationFor(
  translations: readonly WgerTranslation[],
  languageId: number | null,
): { name: string; instructions: string | null } | null {
  if (languageId === null) return null;
  const hit = translations.find((t) => t.language === languageId && (t.name ?? '').trim().length > 0);
  if (!hit) return null;
  const notes = (hit.notes ?? []).map((note) => (note.comment ?? '').trim()).filter((note) => note.length > 0);
  const instructions = resolveInstructions(hit, notes);
  return {
    name: withoutDashes(hit.name.trim()),
    instructions: instructions === null ? null : withoutDashes(instructions),
  };
}

/**
 * Builds the `exerciseinfo` → catalog row mapper for one download.
 *
 * A row maps to null when it cannot be shown: no English or Italian name, or a category the
 * taxonomy does not list (the column is required). Muscle and equipment ids the taxonomy does
 * not list are dropped, so the junction tables never point at a row that is not there.
 */
export function catalogExerciseMapper(
  languageIds: Record<CatalogLanguage, number | null>,
  taxonomy: Taxonomy,
): (info: WgerExerciseInfo) => CatalogExercise | null {
  const categoryIds = new Set(taxonomy.categories.map((c) => c.id));
  const muscleIds = new Set(taxonomy.muscles.map((m) => m.id));
  const equipmentIds = new Set(taxonomy.equipment.map((e) => e.id));

  return (info) => {
    const translations = info.translations ?? [];
    const en = translationFor(translations, languageIds.en);
    const it = translationFor(translations, languageIds.it);
    const categoryId = info.category?.id ?? null;
    if ((en === null && it === null) || categoryId === null || !categoryIds.has(categoryId)) return null;

    const { imageUrl, thumbnailUrl } = pickImages(info.images);
    return {
      id: remoteExerciseId(info.id),
      externalId: info.id,
      uuid: info.uuid || null,
      variationGroup: info.variation_group ?? null,
      categoryId,
      primaryMuscleIds: (info.muscles ?? []).map((m) => m.id).filter((id) => muscleIds.has(id)),
      secondaryMuscleIds: (info.muscles_secondary ?? []).map((m) => m.id).filter((id) => muscleIds.has(id)),
      equipmentIds: (info.equipment ?? []).map((e) => e.id).filter((id) => equipmentIds.has(id)),
      imageUrl,
      thumbnailUrl,
      videoUrl: pickVideo(info.videos),
      translations: { ...(en === null ? {} : { en }), ...(it === null ? {} : { it }) },
    };
  };
}
