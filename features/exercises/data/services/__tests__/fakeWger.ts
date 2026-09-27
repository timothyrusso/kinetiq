import { Effect } from 'effect';
import { HttpError } from '@/features/core/error';

/** The base URL the fake serves under. */
export const FAKE_WGER = 'https://wger.test/api/v2/';

type Row = Record<string, unknown>;

/** An `exerciseinfo` row: German and English names, one muscle, one piece of equipment. */
export function anExerciseInfo(id: number, fields: Row = {}): Row {
  return {
    id,
    uuid: `uuid-${id}`,
    category: { id: 1, name: 'Chest' },
    muscles: [{ id: 1, name: 'Pectoralis major' }],
    muscles_secondary: [],
    equipment: [{ id: 1, name: 'Barbell' }],
    images: [],
    videos: [],
    variation_group: null,
    translations: [
      { id: id * 10, language: 1, name: `Übung ${id}`, description: '<p>Deutsch</p>' },
      { id: id * 10 + 1, language: 2, name: `Exercise ${id}`, description: '<p>Keep it slow</p>' },
    ],
    ...fields,
  };
}

/**
 * A fake wger: the four small endpoints plus `exerciseinfo/`, served from `rows` at most `cap`
 * rows per page whatever limit is asked for, as an Effect transport (`getJson`) or behind `fetch`
 * (`fetchImpl`). `failAt` makes a request fail.
 * `requested` lists every URL asked for, which is what the network saw.
 */
export function makeFakeWger(rows: readonly Row[], cap: number, failAt?: (url: string) => boolean) {
  const requested: string[] = [];
  const list = (results: readonly Row[]) => ({ count: results.length, next: null, previous: null, results });
  const answer = (url: string): unknown => {
    const { pathname, searchParams } = new URL(url);
    switch (pathname.replace(new URL(FAKE_WGER).pathname, '')) {
      case 'language/':
        return list([
          { id: 1, short_name: 'de', full_name: 'Deutsch' },
          { id: 2, short_name: 'en', full_name: 'English' },
          { id: 13, short_name: 'it', full_name: 'Italiano' },
        ]);
      case 'exercisecategory/':
        return list([
          { id: 2, name: 'Legs' },
          { id: 1, name: 'Chest' },
        ]);
      case 'equipment/':
        return list([{ id: 1, name: 'Barbell' }]);
      case 'muscle/':
        return list([{ id: 1, name: 'Pectoralis major', name_en: 'Chest', is_front: true }]);
      case 'exerciseinfo/': {
        const offset = Number(searchParams.get('offset'));
        const limit = Math.min(Number(searchParams.get('limit')), cap);
        return { count: rows.length, next: null, previous: null, results: rows.slice(offset, offset + limit) };
      }
      default:
        return { detail: 'Not found.' };
    }
  };
  const getJson = (url: string) =>
    Effect.suspend(() => {
      requested.push(url);
      return failAt?.(url)
        ? Effect.fail(new HttpError({ kind: 'server', status: 500, retryAfterSeconds: null }))
        : Effect.succeed(answer(url));
    });
  // NOTE: the same server behind `fetch`, answering a failure with a 404, which is never retried.
  const fetchImpl = (url: string) => {
    requested.push(url);
    return Promise.resolve(
      failAt?.(url) ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(answer(url)), { status: 200 }),
    );
  };
  return { getJson, fetchImpl, requested: requested as readonly string[] };
}
