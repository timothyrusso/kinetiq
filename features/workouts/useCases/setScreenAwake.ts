import { Effect } from 'effect';
import { ScreenWake } from '@/features/workouts/domain/services/ScreenWake';

/** Keeps the screen on (`awake`) or lets it sleep again. */
export const setScreenAwake = (awake: boolean) =>
  Effect.flatMap(ScreenWake, wake => (awake ? wake.keepOn : wake.release));
