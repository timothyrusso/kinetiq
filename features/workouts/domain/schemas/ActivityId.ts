import { Schema } from 'effect';

/**
 * A recorded workout's id. A phone session is `session-<base36 time>` and keeps that id as its
 * activity, a watch workout is `watch-<uuid>`; the Schema asks only for a non-empty string, so a
 * row stored under another spelling still opens.
 */
export const ActivityId = Schema.NonEmptyString.pipe(Schema.brand('ActivityId'));

export type ActivityId = typeof ActivityId.Type;
