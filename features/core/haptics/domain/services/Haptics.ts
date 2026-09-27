import { Context, type Effect } from 'effect';
import type { HapticPattern } from '@/features/core/haptics/domain/entities/HapticPattern';

/**
 * Haptic feedback for use cases: `yield* Haptics` then `yield* haptics.play('setCompleted')`.
 * Playing never fails; the user's switch and a missing motor are the Layer's business.
 */
export class Haptics extends Context.Tag('core/haptics/Haptics')<
  Haptics,
  { readonly play: (pattern: HapticPattern) => Effect.Effect<void> }
>() {}
