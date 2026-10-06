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
 * worth keeping until the phone app catches up; `outdated` is an older one, which this phone no
 * longer reads; `invalid` can never be read.
 */
export type WatchWorkoutRead =
  | { readonly ok: true; readonly document: WatchWorkoutDocument }
  | { readonly ok: false; readonly reason: 'version' | 'outdated' | 'invalid' };

const parseJson = Schema.decodeUnknownEither(Schema.parseJson());
const readFormat = Schema.decodeUnknownEither(Schema.Struct({ format: Schema.Literal(WATCH_WORKOUT_FORMAT) }));
const readVersion = Schema.decodeUnknownEither(Schema.Struct({ version: Schema.Number }));
const readDocument = Schema.decodeUnknownEither(WatchWorkoutDocumentSchema);

const INVALID: WatchWorkoutRead = { ok: false, reason: 'invalid' };
const NEWEST = Math.max(...WATCH_WORKOUT_VERSIONS);

/** Null for a version the phone reads; otherwise whether it is older or newer than those. */
function versionProblem(version: number): WatchWorkoutRead | null {
  if (WATCH_WORKOUT_VERSIONS.some(known => known === version)) return null;
  return { ok: false, reason: version > NEWEST ? 'version' : 'outdated' };
}

/**
 * Reads a `kinetiq.watch-workout` document from an inbox entry. Everything is checked before use:
 * the envelope's format and version, the payload's size, then the document against its Schema.
 * A version check comes before the shape check at both levels, so a document of another version
 * is told apart from a broken one, and an older one from a newer one.
 */
export function readWatchWorkout(entry: WatchInboxEntry): WatchWorkoutRead {
  if (entry.format !== WATCH_WORKOUT_FORMAT) return INVALID;
  const envelopeProblem = versionProblem(entry.version);
  if (envelopeProblem !== null) return envelopeProblem;
  if (entry.payload.length === 0 || entry.payload.length > IMPORT_LIMITS.bytes) return INVALID;
  const raw = parseJson(entry.payload);
  if (Either.isLeft(raw) || Either.isLeft(readFormat(raw.right))) return INVALID;
  const version = readVersion(raw.right);
  if (Either.isLeft(version)) return INVALID;
  const documentProblem = versionProblem(version.right.version);
  if (documentProblem !== null) return documentProblem;
  const document = readDocument(raw.right);
  return Either.isRight(document) ? { ok: true, document: document.right } : INVALID;
}
