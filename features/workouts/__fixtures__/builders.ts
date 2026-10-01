import type { Exercise } from '@/features/exercises';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { CompletedWorkout } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import type {
  SessionPlan,
  SessionPlanItem,
  SessionPlanSet,
} from '@/features/workouts/domain/schemas/SessionPlanSchema';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';

/** Monday 16 June 2025, 18:00 local: the time the builders' workouts happen. */
export const WORKOUT_TIME = new Date(2025, 5, 16, 18, 0, 0).getTime();

/** A completed working set: 5 reps at 100 kg, its estimate already written. */
export const aSet = (overrides: Partial<StrengthSet> = {}): StrengthSet => ({
  index: 0,
  reps: 5,
  weightKg: 100,
  completed: true,
  estimated1rm: 116.5,
  rpe: null,
  ...overrides,
});

/** The same set, not done yet. */
export const anOpenSet = (overrides: Partial<StrengthSet> = {}): StrengthSet =>
  aSet({ completed: false, estimated1rm: null, ...overrides });

/** Bench press, two sets of five at 100 kg, both done, resting 90 s. */
export const anEntry = (overrides: Partial<StrengthEntry> = {}): StrengthEntry => ({
  exerciseId: 'ex:barbell-bench-press',
  exerciseName: 'Bench Press',
  muscleGroup: null,
  sets: [aSet(), aSet({ index: 1 })],
  notes: null,
  restSeconds: 90,
  ...overrides,
});

/** A second exercise: overhead press, three sets of eight at 40 kg, none done. */
export const anotherEntry = (overrides: Partial<StrengthEntry> = {}): StrengthEntry =>
  anEntry({
    exerciseId: 'ex:barbell-squat',
    exerciseName: 'Overhead Press',
    sets: [0, 1, 2].map(index => anOpenSet({ index, reps: 8, weightKg: 40 })),
    notes: 'Brace first',
    restSeconds: 60,
    ...overrides,
  });

/** A push day in progress, started at `WORKOUT_TIME`, ten minutes in, on its first exercise. */
export const aSession = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: ActivityId.make('session-mbz1a2b3'),
  routineId: 'rtn_push',
  routineName: 'Push Day',
  startedAt: WORKOUT_TIME,
  elapsedSeconds: 600,
  status: 'active',
  entries: [anEntry(), anotherEntry()],
  activeIndex: 0,
  restEndsAt: null,
  restDurationSeconds: null,
  notes: null,
  updatedAt: WORKOUT_TIME + 600_000,
  ...overrides,
});

/** A finished push day, 45 minutes long, on its way into history. */
export const aCompletedWorkout = (overrides: Partial<CompletedWorkout> = {}): CompletedWorkout => ({
  id: ActivityId.make('session-mbz1a2b3'),
  routineId: 'rtn_push',
  title: 'Push Day',
  startedAt: WORKOUT_TIME,
  endedAt: WORKOUT_TIME + 2_700_000,
  durationSeconds: 2700,
  entries: [anEntry()],
  totalVolumeKg: 1000,
  totalSets: 2,
  notes: null,
  ...overrides,
});

/** The same push day as it reads back from history. */
export const anActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: ActivityId.make('session-mbz1a2b3'),
  kind: 'lift',
  title: 'Push Day',
  startedAt: WORKOUT_TIME,
  durationSeconds: 2700,
  notes: null,
  sourceSessionId: 'session-mbz1a2b3',
  strength: { entries: [anEntry()], totalVolumeKg: 1000, totalSets: 2, personalRecords: [] },
  ...overrides,
});

/** A bench press estimated-max record of 116.5 kg, set at `WORKOUT_TIME`. */
export const aRecord = (overrides: Partial<PersonalRecord> = {}): PersonalRecord => ({
  exerciseId: 'ex:barbell-bench-press',
  exerciseName: 'Bench Press',
  kind: 'est1rm',
  value: 116.5,
  achievedAt: WORKOUT_TIME,
  previousValue: null,
  ...overrides,
});

/** `count` planned sets of `reps` at `weightKg`, with no target RPE. */
export const plannedSets = (count: number, reps: number, weightKg: number): SessionPlanSet[] =>
  Array.from({ length: count }, () => ({ reps, weightKg, targetRpe: null }));

/** One plan item: bench press, three sets of 8 at 60 kg, resting 90 s. */
export const aPlanItem = (overrides: Partial<SessionPlanItem> = {}): SessionPlanItem => ({
  exerciseId: 'ex:barbell-bench-press',
  exerciseName: 'Bench Press',
  sets: plannedSets(3, 8, 60),
  restSeconds: 90,
  notes: null,
  ...overrides,
});

/** A push day's plan with two exercises, from routine `rtn_push`. */
export const aPlan = (overrides: Partial<SessionPlan> = {}): SessionPlan => ({
  routineId: 'rtn_push',
  name: 'Push Day',
  items: [
    aPlanItem(),
    aPlanItem({
      exerciseId: 'ex:barbell-squat',
      exerciseName: 'Overhead Press',
      sets: plannedSets(4, 6, 40),
      notes: 'Brace first',
    }),
  ],
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
