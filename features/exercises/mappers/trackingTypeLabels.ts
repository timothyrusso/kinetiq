import type { TKey } from '@/features/core/translations';
import { TrackingType } from '@/features/exercises/domain/schemas/TrackingType';

/** Every tracking type, in the order a picker offers them: the most common first. */
export const TRACKING_TYPES: readonly TrackingType[] = TrackingType.literals;

/**
 * How each tracking type reads in the type control of both exercise sheets, as catalog KEYS: this
 * is module scope, where there is no language yet. Short enough for a three-segment control.
 */
export const TRACKING_TYPE_LABEL: Record<TrackingType, TKey> = {
  weightReps: 'tracking.weightReps',
  repsOnly: 'tracking.repsOnly',
  duration: 'tracking.time',
};
