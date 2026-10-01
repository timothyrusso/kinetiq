import type { Exercise, ExerciseSnapshot } from '@/features/exercises';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { Routine, RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { uniformSets } from '@/features/routines/domain/utils/itemTargets';

/** One item of a push day: bench press, three sets of eight at 60 kg. */
export const aRoutineItem = (overrides: Partial<RoutineItem> = {}): RoutineItem => ({
  id: 'rit_bench',
  exerciseId: 'ex:barbell-bench-press',
  exerciseName: 'Bench Press',
  sets: uniformSets(3, 8, 60),
  restSeconds: 90,
  notes: null,
  ...overrides,
});

/** A second item: overhead press, four sets of six at 40 kg, resting 60 s. */
export const anotherRoutineItem = (overrides: Partial<RoutineItem> = {}): RoutineItem =>
  aRoutineItem({
    id: 'rit_press',
    exerciseId: 'ex:barbell-squat',
    exerciseName: 'Overhead Press',
    sets: uniformSets(4, 6, 40),
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
  exerciseId: 'ex:barbell-bench-press',
  name: 'Bench Press',
  instructions: ['Lower the bar to the chest, then press.'],
  category: 'Chest',
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Triceps'],
  equipment: ['Barbell'],
  imageUrl: 'assets/catalog/images/barbell-bench-press-medium-grip/0.webp',
  thumbnailUrl: 'assets/catalog/images/barbell-bench-press-medium-grip/thumb.webp',
  capturedAt: 1_700_000_000_000,
  ...overrides,
});

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
