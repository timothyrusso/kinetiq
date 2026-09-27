import { Effect, Layer } from 'effect';
import { Haptics } from '@/features/core/haptics/domain/services/Haptics';
import { haptics } from '@/features/core/haptics/haptics';

/** Plays each pattern through the device motor, honouring the user's haptics switches. */
export const HapticsDeviceLive = Layer.succeed(Haptics, {
  play: pattern => Effect.sync(() => haptics[pattern]()),
});
