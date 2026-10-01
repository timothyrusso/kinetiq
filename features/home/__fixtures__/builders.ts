import type { Exercise } from '@/features/exercises';
import type { RoutineItem } from '@/features/routines';
import { ActivityId, type CompletedWorkout, type SessionPlan, type StrengthEntry } from '@/features/workouts';

/** Monday 16 June 2025, 18:00 local: when the builders' workouts happen. */
export const WORKOUT_TIME = new Date(2025, 5, 16, 18, 0, 0).getTime();

/** The bench press as the catalog reads it. */
export const anExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'ex:barbell-bench-press',
  name: 'Bench Press',
  instructions: ['Lower the bar to the chest, then press.'],
  category: 'Chest',
  bodyArea: 'chest',
  trainingType: 'strength',
  level: 'beginner',
  force: 'push',
  mechanic: 'compound',
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Triceps'],
  equipment: ['Barbell'],
  imageUrl: 'assets/catalog/images/barbell-bench-press-medium-grip/0.webp',
  imageEndUrl: 'assets/catalog/images/barbell-bench-press-medium-grip/1.webp',
  thumbnailUrl: 'assets/catalog/images/barbell-bench-press-medium-grip/thumb.webp',
  source: 'catalog',
  ...overrides,
});

/** A second catalog exercise: the squat. */
export const aSquat = (): Exercise =>
  anExercise({ id: 'ex:goblet-squat', name: 'Squat', category: 'Legs', primaryMuscles: ['Quads'] });

/** One routine item: bench press, three sets of eight at 60 kg, resting 90 s. */
export const aRoutineItem = (overrides: Partial<RoutineItem> = {}): RoutineItem => ({
  id: 'rit_bench',
  exerciseId: 'ex:barbell-bench-press',
  exerciseName: 'Bench Press',
  sets: [0, 1, 2].map(index => ({ index, reps: 8, weightKg: 60, targetRpe: null })),
  restSeconds: 90,
  notes: null,
  ...overrides,
});

/** One bench press entry of a workout: two sets of five at 100 kg, one of them done. */
const anEntry = (overrides: Partial<StrengthEntry> = {}): StrengthEntry => ({
  exerciseId: 'ex:barbell-bench-press',
  exerciseName: 'Bench Press',
  muscleGroup: null,
  sets: [
    { index: 0, reps: 5, weightKg: 100, completed: true, estimated1rm: 116.5, rpe: null },
    { index: 1, reps: 5, weightKg: 100, completed: false, estimated1rm: null, rpe: null },
  ],
  notes: null,
  restSeconds: 90,
  ...overrides,
});

/** A push day's plan with the bench press only, from no routine. */
export const aPlan = (overrides: Partial<SessionPlan> = {}): SessionPlan => ({
  routineId: null,
  name: 'Push Day',
  items: [
    {
      exerciseId: 'ex:barbell-bench-press',
      exerciseName: 'Bench Press',
      sets: [0, 1, 2].map(() => ({ reps: 8, weightKg: 60, targetRpe: null })),
      restSeconds: 90,
      notes: null,
    },
  ],
  ...overrides,
});

/** A finished push day, 45 minutes long, on its way into history. */
export const aCompletedWorkout = (overrides: Partial<CompletedWorkout> = {}): CompletedWorkout => ({
  id: ActivityId.make('session-home-1'),
  routineId: null,
  title: 'Push Day',
  startedAt: WORKOUT_TIME,
  endedAt: WORKOUT_TIME + 2_700_000,
  durationSeconds: 2700,
  entries: [anEntry()],
  totalVolumeKg: 500,
  totalSets: 1,
  notes: null,
  ...overrides,
});
