import { Effect, Layer } from 'effect';
import { type HapticPattern, Haptics } from '@/features/core/haptics';

/** A `Haptics` that records what it was asked to play, oldest first, instead of buzzing. */
export const makeHapticsFake = () => {
  const played: HapticPattern[] = [];
  return {
    layer: Layer.succeed(Haptics, { play: pattern => Effect.sync(() => void played.push(pattern)) }),
    played: played as readonly HapticPattern[],
  };
};
