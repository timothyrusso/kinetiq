import { useAppTheme } from '@/features/core/theme';
import { ActiveWorkoutPill } from '@/features/workouts/ui/components/ActiveWorkoutPill/ActiveWorkoutPill';
import { useWorkoutAccessoryLogic } from '@/features/workouts/ui/pages/WorkoutAccessory/WorkoutAccessory.logic';

/**
 * The live-workout pill, for the tab bar's accessory slot. Its own component because the session
 * republishes every second: inline, that tick would re-render the whole tab layout and the
 * navigator with it; split, it re-renders the pill and nothing else.
 */
export function WorkoutAccessory() {
  const { derived, effects } = useWorkoutAccessoryLogic();
  const theme = useAppTheme();
  if (derived.label === null) return null;
  return <ActiveWorkoutPill label={derived.label} detail={derived.detail} onPress={effects.open} theme={theme} />;
}
