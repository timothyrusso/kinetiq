import { Schema } from 'effect';
import {
  type WatchRoutinesDocument,
  WatchRoutinesDocumentSchema,
} from '@/features/watch-bridge/domain/schemas/WatchRoutinesDocumentSchema';

const encode = Schema.encodeSync(WatchRoutinesDocumentSchema);

/**
 * The routine snapshot as the JSON the watch reads. Throws when the document breaks the bounds
 * the watch enforces: the snapshot builder clamps every value, so that is a bug, not data.
 */
export const encodeWatchRoutines = (document: WatchRoutinesDocument): string => JSON.stringify(encode(document));
