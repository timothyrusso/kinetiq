import type { Exercise, ExerciseSnapshot } from '@/features/exercises';
import type { Routine, RoutineItem, RoutineSet } from '@/features/routines';
import { RoutineId } from '@/features/routines';
import type { Activity, StrengthEntry } from '@/features/workouts';
import { ActivityId } from '@/features/workouts';

/** Thursday 25 September 2026, 10:00 UTC: the moment every fixture export was taken. */
export const EXPORTED_AT = Date.UTC(2026, 8, 25, 10, 0, 0);

/** Bench press: two sets of five at 100 kg, the second not done, resting 120 s. */
const aBenchEntry = (overrides: Partial<StrengthEntry> = {}): StrengthEntry => ({
  exerciseId: 'wger:73',
  exerciseName: 'Bench Press',
  muscleGroup: 'Chest',
  restSeconds: 120,
  notes: null,
  sets: [
    { index: 0, reps: 5, weightKg: 100, completed: true, estimated1rm: 116.66666666666667, rpe: 8 },
    { index: 1, reps: 5, weightKg: 100, completed: false, estimated1rm: null, rpe: null },
  ],
  ...overrides,
});

/** A push day, 45 minutes on 22 September 2026. */
const anActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: ActivityId.make('session-mfv2k1a0'),
  kind: 'lift',
  title: 'Push Day',
  startedAt: Date.UTC(2026, 8, 22, 17, 30, 0),
  durationSeconds: 2700,
  notes: null,
  sourceSessionId: 'session-mfv2k1a0',
  strength: { entries: [aBenchEntry()], totalVolumeKg: 500, totalSets: 1, personalRecords: [] },
  ...overrides,
});

/**
 * Three workouts, oldest first, with what a CSV has to quote: a comma, a double quote and a line
 * break in a title or a name, a watch workout, an entry with notes and a damaged row with no sets.
 */
export const someActivities = (): Activity[] => [
  anActivity(),
  anActivity({
    id: ActivityId.make('watch-7A1D0C3E-1111-4222-8333-944455556666'),
    title: 'Legs, "heavy"',
    startedAt: Date.UTC(2026, 8, 23, 6, 15, 0),
    durationSeconds: 3120,
    notes: 'Knees felt good\nDeload next week',
    sourceSessionId: null,
    strength: {
      entries: [
        aBenchEntry({
          exerciseId: 'wger:111',
          exerciseName: 'Squat, Back',
          muscleGroup: null,
          restSeconds: 180,
          notes: 'Belt on top sets',
          sets: [
            { index: 0, reps: 3, weightKg: 142.5, completed: true, estimated1rm: 156.75, rpe: 9.5 },
            { index: 1, reps: 8, weightKg: 0, completed: true, estimated1rm: null, rpe: null },
          ],
        }),
        aBenchEntry({
          exerciseId: 'local:hip-thrust',
          exerciseName: 'Hip thrust',
          muscleGroup: null,
          restSeconds: 90,
          sets: [{ index: 0, reps: 12, weightKg: 60.25, completed: true, estimated1rm: 84.35, rpe: null }],
        }),
      ],
      totalVolumeKg: 1150,
      totalSets: 3,
      personalRecords: [],
    },
  }),
  anActivity({
    id: ActivityId.make('session-mfx0zz99'),
    title: 'Damaged',
    startedAt: Date.UTC(2026, 8, 24, 20, 0, 0),
    durationSeconds: 60,
    sourceSessionId: 'session-mfx0zz99',
    strength: null,
  }),
];

/** `count` sets of `reps` at `weightKg`, with no target RPE. */
const setsOf = (count: number, reps: number, weightKg: number): RoutineSet[] =>
  Array.from({ length: count }, (_, index) => ({ index, reps, weightKg, targetRpe: null }));

/** One item: bench press, three sets of eight at 60 kg, resting 90 s. */
const anItem = (overrides: Partial<RoutineItem> = {}): RoutineItem => ({
  id: 'rit_bench',
  exerciseId: 'wger:73',
  exerciseName: 'Bench Press',
  sets: setsOf(3, 8, 60),
  restSeconds: 90,
  notes: null,
  ...overrides,
});

/** A push day with two items. */
const aRoutine = (overrides: Partial<Routine> = {}): Routine => ({
  id: RoutineId.make('rtn_push'),
  name: 'Push Day',
  items: [
    anItem(),
    anItem({
      id: 'rit_press',
      exerciseId: 'wger:74',
      exerciseName: 'Overhead Press',
      sets: setsOf(4, 6, 40),
      restSeconds: 60,
      notes: 'Brace first',
    }),
  ],
  createdAt: Date.UTC(2026, 8, 1, 9, 0, 0),
  updatedAt: Date.UTC(2026, 8, 20, 9, 0, 0),
  timesCompleted: 4,
  lastPerformedAt: Date.UTC(2026, 8, 22, 17, 30, 0),
  ...overrides,
});

/** Two routines, most recently changed first, one with a local exercise and a quarter-kilo weight. */
export const someRoutines = (): Routine[] => [
  aRoutine({
    id: RoutineId.make('rtn_legs'),
    name: 'Legs · Heavy',
    items: [
      anItem({
        id: 'rit_squat',
        exerciseId: 'wger:111',
        exerciseName: 'Squat, Back',
        sets: setsOf(5, 5, 142.5),
        restSeconds: 180,
        notes: 'Belt on top sets',
      }),
      anItem({
        id: 'rit_thrust',
        exerciseId: 'local:hip-thrust',
        exerciseName: 'Hip thrust',
        sets: setsOf(3, 10, 60.25),
        restSeconds: 90,
      }),
    ],
    updatedAt: Date.UTC(2026, 8, 23, 9, 0, 0),
    timesCompleted: 0,
    lastPerformedAt: null,
  }),
  aRoutine(),
];

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
  capturedAt: Date.UTC(2026, 8, 1, 9, 0, 0),
  ...overrides,
});
