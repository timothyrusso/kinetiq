import type { Exercise, ExerciseSnapshot } from '@/features/exercises';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { Routine, RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/** One item of a push day: bench press, three sets of eight to twelve at 60 kg. */
export const aRoutineItem = (overrides: Partial<RoutineItem> = {}): RoutineItem => ({
  id: 'rit_bench',
  exerciseId: 'wger:73',
  exerciseName: 'Bench Press',
  sets: 3,
  reps: '8-12',
  weightKg: 60,
  restSeconds: 90,
  notes: null,
  ...overrides,
});

/** A second item: overhead press, bodyweight rest of 60 s. */
export const anotherRoutineItem = (overrides: Partial<RoutineItem> = {}): RoutineItem =>
  aRoutineItem({
    id: 'rit_press',
    exerciseId: 'wger:74',
    exerciseName: 'Overhead Press',
    sets: 4,
    reps: '6',
    weightKg: 40,
    restSeconds: 60,
    notes: 'Brace first',
    ...overrides,
  });

/** A push day with two items, never trained. */
export const aRoutine = (overrides: Partial<Routine> = {}): Routine => ({
  id: RoutineId.make('rtn_push'),
  name: 'Push Day',
  items: [aRoutineItem(), anotherRoutineItem()],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  timesCompleted: 0,
  lastPerformedAt: null,
  ...overrides,
});

/** The stored copy of the bench press. */
export const anExerciseSnapshot = (overrides: Partial<ExerciseSnapshot> = {}): ExerciseSnapshot => ({
  exerciseId: 'wger:73',
  name: 'Bench Press',
  instructions: 'Lower the bar to the chest, then press.',
  category: 'Chest',
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Triceps'],
  equipment: ['Barbell'],
  imageUrl: 'https://wger.de/media/bench.png',
  thumbnailUrl: 'https://wger.de/media/bench-small.png',
  externalId: 73,
  capturedAt: 1_700_000_000_000,
  ...overrides,
});

/** The bench press as the catalog reads it. */
export const anExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'wger:73',
  name: 'Bench Press',
  instructions: 'Lower the bar to the chest, then press.',
  category: 'Chest',
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Triceps'],
  equipment: ['Barbell'],
  imageUrl: 'https://wger.de/media/bench.png',
  thumbnailUrl: 'https://wger.de/media/bench-small.png',
  videoUrl: null,
  source: 'remote',
  externalId: 73,
  ...overrides,
});
