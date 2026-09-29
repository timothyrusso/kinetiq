import { Either, Schema } from 'effect';
import { IMPORT_LIMITS } from '@/features/watch-bridge/domain/entities/WatchBounds';
import { WATCH_WORKOUT_FORMAT, WATCH_WORKOUT_VERSIONS } from '@/features/watch-bridge/domain/entities/WatchFormat';
import type { WatchInboxEntry } from '@/features/watch-bridge/domain/schemas/WatchInboxEntrySchema';
import {
  type WatchWorkoutDocument,
  WatchWorkoutDocumentSchema,
} from '@/features/watch-bridge/domain/schemas/WatchWorkoutDocumentSchema';

/**
 * What an inbox entry holds: a workout document, or why not. `version` is a newer watch app,
 * worth keeping until the phone app catches up; `invalid` can never be read.
 */
export type WatchWorkoutRead =
  | { readonly ok: true; readonly document: WatchWorkoutDocument }
  | { readonly ok: false; readonly reason: 'version' | 'invalid' };

const parseJson = Schema.decodeUnknownEither(Schema.parseJson());
const readFormat = Schema.decodeUnknownEither(Schema.Struct({ format: Schema.Literal(WATCH_WORKOUT_FORMAT) }));
const readVersion = Schema.decodeUnknownEither(Schema.Struct({ version: Schema.Literal(...WATCH_WORKOUT_VERSIONS) }));
const readDocument = Schema.decodeUnknownEither(WatchWorkoutDocumentSchema);

const INVALID: WatchWorkoutRead = { ok: false, reason: 'invalid' };
const VERSION: WatchWorkoutRead = { ok: false, reason: 'version' };

/**
 * Reads a `kinetiq.watch-workout` document from an inbox entry. Everything is checked before use:
 * the envelope's format and version, the payload's size, then the document against its Schema.
 * A version check comes before the shape check at both levels, so a newer document is told apart
 * from a broken one.
 */
export function readWatchWorkout(entry: WatchInboxEntry): WatchWorkoutRead {
  if (entry.format !== WATCH_WORKOUT_FORMAT) return INVALID;
  if (!WATCH_WORKOUT_VERSIONS.some(version => version === entry.version)) return VERSION;
  if (entry.payload.length === 0 || entry.payload.length > IMPORT_LIMITS.bytes) return INVALID;
  const raw = parseJson(entry.payload);
  if (Either.isLeft(raw) || Either.isLeft(readFormat(raw.right))) return INVALID;
  if (Either.isLeft(readVersion(raw.right))) return VERSION;
  const document = readDocument(raw.right);
  return Either.isRight(document) ? { ok: true, document: document.right } : INVALID;
}
