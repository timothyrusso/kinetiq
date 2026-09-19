/**
 * DTO → domain mapping for wger responses.
 *
 * The interesting problem is language: `translations[]` arrives in *every*
 * language regardless of the `language__code` filter (that filter narrows which
 * exercises come back, not which translations each row carries), and wger does
 * not order them by preference. So `translations[0]` is a coin flip — for
 * exercise 73 it is German. Everything here resolves against an explicit
 * preference list and falls back rather than inventing content.
 */
import { remoteExerciseId } from '@/domain/exerciseId';
import type { Exercise, Taxon } from '@/domain/types';
import type {
  WgerExerciseInfo,
  WgerImage,
  WgerLanguage,
  WgerMuscle,
  WgerNamedEntity,
  WgerTranslation,
} from './dto';

/** wger's own numeric id for English; used as the universal fallback. */
export const WGER_ENGLISH_ID = 2;

export type LanguagePreference = {
  /** Numeric wger language ids in preference order, e.g. [5, 2]. */
  ids: number[];
};

function preferredTranslation(
  translations: readonly WgerTranslation[],
  preference: LanguagePreference,
): WgerTranslation | null {
  if (translations.length === 0) return null;
  // Prefer the user's language *with a usable name*; an empty translation is
  // worse than a complete one in another language.
  for (const id of preference.ids) {
    const hit = translations.find((t) => t.language === id && (t.name ?? '').trim().length > 0);
    if (hit) return hit;
  }
  const english = translations.find(
    (t) => t.language === WGER_ENGLISH_ID && (t.name ?? '').trim().length > 0,
  );
  if (english) return english;
  const anyName = translations.find((t) => (t.name ?? '').trim().length > 0);
  return anyName ?? translations[0] ?? null;
}

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
export function htmlToPlainText(html: string | null | undefined): string | null {
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

function distinctNames(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Muscles come back with a Latin `name` and an optional English `name_en`.
 * The common name is what a user recognises ("Hamstrings", not
 * "Biceps femoris"), so it wins when present.
 */
function muscleNames(muscles: readonly WgerMuscle[] | null | undefined): string[] {
  return distinctNames((muscles ?? []).map((m) => m.name_en?.trim() || m.name || ''));
}

function entityNames(entities: readonly WgerNamedEntity[] | null | undefined): string[] {
  return distinctNames((entities ?? []).map((e) => e.name ?? ''));
}

/**
 * Chooses the art to show. `is_main` is the author's own pick, so it wins;
 * otherwise the first image. `medium` thumbnails are preferred for both slots
 * because the full `image` is often a large scan while the thumbnail variants
 * are consistently sized — and 400px covers a detail header on a phone.
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

export function mapTaxon(entity: WgerNamedEntity): Taxon {
  return { id: entity.id, name: entity.name.trim() || `#${entity.id}` };
}

export function mapMuscleTaxon(muscle: WgerMuscle): Taxon {
  return {
    id: muscle.id,
    name: (muscle.name_en?.trim() || muscle.name || `#${muscle.id}`).trim(),
  };
}

export function mapLanguageCodes(languages: readonly WgerLanguage[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const language of languages) {
    const code = (language.short_name ?? '').trim().toLowerCase();
    if (code) map.set(language.id, code);
  }
  return map;
}

/**
 * `exerciseinfo` → `Exercise`. The row is complete on its own (media included),
 * so a list page and a detail screen map with the same function.
 *
 * Nothing here synthesises a value: a missing category, muscle list or image
 * stays null/empty, and the UI has a designed state for each.
 */
export function mapExerciseInfo(
  info: WgerExerciseInfo,
  context: { preference: LanguagePreference },
): Exercise {
  const translations = info.translations ?? [];
  const translation = preferredTranslation(translations, context.preference);
  const notes = (translation?.notes ?? [])
    .map((note) => (note.comment ?? '').trim())
    .filter((note) => note.length > 0);
  const { imageUrl, thumbnailUrl } = pickImages(info.images);

  return {
    id: remoteExerciseId(info.id),
    name: (translation?.name ?? '').trim() || `Exercise ${info.id}`,
    instructions: resolveInstructions(translation, notes),
    category: info.category?.name?.trim() || null,
    primaryMuscles: muscleNames(info.muscles),
    secondaryMuscles: muscleNames(info.muscles_secondary),
    equipment: entityNames(info.equipment),
    imageUrl,
    thumbnailUrl,
    videoUrl: pickVideo(info.videos),
    source: 'remote',
    externalId: info.id,
  };
}
