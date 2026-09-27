import { Schema } from 'effect';

/**
 * A finished watch workout as the native inbox holds it, before the payload is read. On the wire
 * each document travels as `{ format, version, id, payload }` with the document as JSON in
 * `payload`: WatchConnectivity dictionaries take property-list types only, and `null` (a cleared
 * note, an unrecorded RPE) is not one.
 */
export const WatchInboxEntrySchema = Schema.Struct({
  id: Schema.String,
  format: Schema.String,
  version: Schema.Number,
  // NOTE: empty when the file on disk could not be read.
  payload: Schema.String,
});

export type WatchInboxEntry = typeof WatchInboxEntrySchema.Type;
