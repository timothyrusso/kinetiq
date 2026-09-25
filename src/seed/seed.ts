/**
 * Seed data for a fresh install.
 *
 * Deliberately separate from the exercise provider: every seeded exercise is
 * written as a `local` snapshot with a locally minted id, so a seeded routine is
 * exactly as offline-safe as one the user built from the remote catalog. Nothing
 * here touches the network, and deleting this module would leave the rest of the
 * app working: it would just start empty.
 *
 * Randomness is seeded (mulberry32), so the same install shape produces the same
 * history. That makes screenshots, QA scripts and bug reports comparable.
 */
import type {
  Activity,
  ExerciseSnapshot,
  PersonalRecord,
  Routine,
  RoutineItem,
  StrengthEntry,
  StrengthSet,
} from '@/domain/types';
import {
  entryVolumeKg,
  estimateCalories,
  estimatedOneRepMax,
  totalVolumeKg,
} from '@/domain/logic';
import { createRandom, localId, randomInRange, roundTo } from '@/utils/functional';
import { addDays, startOfDay, startOfWeek } from '@/utils/format';
import {
  activityRepository,
  readState,
  recordRepository,
  routineRepository,
  SEED_DONE_KEY,
  SETTING_KEYS,
  setSetting,
  upsertSnapshot,
  writeState,
} from '@/persistence';

const WEEKS = 13;

export type SeedResult = {
  activities: number;
  routines: number;
  exercises: number;
  records: number;
  firstActivityAt: number;
};

/* ------------------------------------------------------------ exercises -- */

type SeedExercise = {
  key: string;
  name: string;
  category: string;
  primary: string[];
  secondary: string[];
  equipment: string[];
  instructions: string | null;
  /** Typical working weight, so history reads as plausible loading. */
  baseWeightKg: number;
  /** Kilograms added per week of history. */
  progressPerWeek: number;
  bodyweight?: boolean;
  /** Rest seconds the seeded routines should carry. */
  restSeconds: number;
};

/**
 * Local catalog used by seeds and by the user's own custom exercises.
 * `instructions` is null on several entries on purpose: real wger data is
 * frequently incomplete, so the missing-instruction state has to be exercised on
 * a plain fresh install rather than only in theory. Same for `imageUrl`.
 */
export const SEED_EXERCISES: readonly SeedExercise[] = [
  { key: 'barbell-back-squat', name: 'Barbell Back Squat', category: 'Legs', primary: ['Quadriceps'], secondary: ['Glutes', 'Lower back'], equipment: ['Barbell', 'Squat rack'], instructions: 'Brace the core, break at hip and knee together, and drive back up through the mid-foot.', baseWeightKg: 90, progressPerWeek: 1.8, restSeconds: 180 },
  { key: 'conventional-deadlift', name: 'Conventional Deadlift', category: 'Back', primary: ['Lower back'], secondary: ['Glutes', 'Hamstrings', 'Forearms'], equipment: ['Barbell'], instructions: 'Hinge until the shins meet the bar, keep the chest proud, and stand tall without hyperextending.', baseWeightKg: 110, progressPerWeek: 2.2, restSeconds: 180 },
  { key: 'bench-press', name: 'Bench Press', category: 'Chest', primary: ['Chest'], secondary: ['Front deltoids', 'Triceps'], equipment: ['Barbell', 'Flat bench'], instructions: 'Shoulder blades down and back, bar to the lower sternum, elbow path about 45 degrees from the torso.', baseWeightKg: 70, progressPerWeek: 1.2, restSeconds: 180 },
  { key: 'overhead-press', name: 'Overhead Press', category: 'Shoulders', primary: ['Shoulders'], secondary: ['Triceps'], equipment: ['Barbell'], instructions: null, baseWeightKg: 40, progressPerWeek: 0.7, restSeconds: 150 },
  { key: 'pull-up', name: 'Pull-Up', category: 'Back', primary: ['Lats'], secondary: ['Biceps', 'Forearms'], equipment: ['Pull-up bar'], instructions: 'Start from a dead hang, pull the sternum toward the bar, control the descent.', baseWeightKg: 0, progressPerWeek: 0, bodyweight: true, restSeconds: 120 },
  { key: 'bent-over-row', name: 'Bent-Over Barbell Row', category: 'Back', primary: ['Upper back'], secondary: ['Lats', 'Biceps'], equipment: ['Barbell'], instructions: 'Hinge to roughly parallel, pull to the navel, keep the torso still.', baseWeightKg: 60, progressPerWeek: 1.1, restSeconds: 120 },
  { key: 'romanian-deadlift', name: 'Romanian Deadlift', category: 'Legs', primary: ['Hamstrings'], secondary: ['Glutes', 'Lower back'], equipment: ['Barbell'], instructions: null, baseWeightKg: 80, progressPerWeek: 1.4, restSeconds: 120 },
  { key: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', category: 'Legs', primary: ['Quadriceps'], secondary: ['Glutes'], equipment: ['Dumbbells', 'Flat bench'], instructions: 'Front foot far enough forward that the knee tracks over the toes rather than past them.', baseWeightKg: 22, progressPerWeek: 0.6, restSeconds: 90 },
  { key: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', category: 'Chest', primary: ['Chest'], secondary: ['Front deltoids'], equipment: ['Dumbbells', 'Incline bench'], instructions: null, baseWeightKg: 24, progressPerWeek: 0.5, restSeconds: 90 },
  { key: 'lateral-raise', name: 'Lateral Raise', category: 'Shoulders', primary: ['Shoulders'], secondary: [], equipment: ['Dumbbells'], instructions: 'Lead with the elbow, stop around shoulder height, resist the urge to shrug.', baseWeightKg: 8, progressPerWeek: 0.2, restSeconds: 60 },
  { key: 'hanging-leg-raise', name: 'Hanging Leg Raise', category: 'Abs', primary: ['Abdominals'], secondary: ['Hip flexors'], equipment: ['Pull-up bar'], instructions: null, baseWeightKg: 0, progressPerWeek: 0, bodyweight: true, restSeconds: 60 },
  { key: 'ez-bar-curl', name: 'EZ-Bar Curl', category: 'Arms', primary: ['Biceps'], secondary: ['Forearms'], equipment: ['Ez-bar'], instructions: 'Elbows pinned to the ribs; if the torso moves, the weight is too heavy.', baseWeightKg: 25, progressPerWeek: 0.4, restSeconds: 75 },
  { key: 'cable-pushdown', name: 'Cable Pushdown', category: 'Arms', primary: ['Triceps'], secondary: [], equipment: ['Cable machine'], instructions: null, baseWeightKg: 27.5, progressPerWeek: 0.5, restSeconds: 75 },
  { key: 'leg-press', name: 'Leg Press', category: 'Legs', primary: ['Quadriceps'], secondary: ['Glutes'], equipment: ['Leg press machine'], instructions: 'High foot placement biases the glutes, low placement biases the quadriceps.', baseWeightKg: 160, progressPerWeek: 3.5, restSeconds: 120 },
];

const exerciseByKey = new Map(SEED_EXERCISES.map((e) => [e.key, e]));

const snapshots = new Map<string, ExerciseSnapshot>();

function snapshotFor(key: string, capturedAt: number): ExerciseSnapshot {
  const cached = snapshots.get(key);
  if (cached) return cached;
  const source = exerciseByKey.get(key);
  if (!source) throw new Error(`unknown seed exercise: ${key}`);
  const snapshot: ExerciseSnapshot = {
    exerciseId: `local:${source.key}`,
    name: source.name,
    instructions: source.instructions,
    category: source.category,
    primaryMuscles: source.primary,
    secondaryMuscles: source.secondary,
    equipment: source.equipment,
    imageUrl: null,
    thumbnailUrl: null,
    externalId: null,
    capturedAt,
  };
  snapshots.set(key, snapshot);
  return snapshot;
}

/* ------------------------------------------------------------- strength -- */

type PlanTemplate = {
  name: string;
  description: string | null;
  keys: string[];
  /** Planned working sets, parallel to `keys`. */
  sets: number[];
};

const PLANS: readonly PlanTemplate[] = [
  {
    name: 'Push · Heavy',
    description: 'Bench-led pressing with overhead volume behind it. Full rests on the first lift.',
    keys: ['bench-press', 'overhead-press', 'incline-dumbbell-press', 'lateral-raise', 'cable-pushdown'],
    sets: [5, 4, 3, 3, 3],
  },
  {
    name: 'Pull · Heavy',
    description: 'Deadlifts first while fresh, then rows and vertical pulling.',
    keys: ['conventional-deadlift', 'bent-over-row', 'pull-up', 'ez-bar-curl', 'hanging-leg-raise'],
    sets: [5, 4, 4, 3, 3],
  },
  {
    name: 'Legs · Squat Focus',
    description: 'Back squat top set plus back-off volume, single-leg work at the end.',
    keys: ['barbell-back-squat', 'romanian-deadlift', 'bulgarian-split-squat', 'leg-press', 'hanging-leg-raise'],
    sets: [5, 3, 3, 3, 3],
  },
];

const REP_LADDER = [5, 5, 6, 8, 10];

function buildEntry(
  key: string,
  weekIndex: number,
  plannedSets: number,
  rng: () => number,
  atTime: number,
): StrengthEntry {
  const source = exerciseByKey.get(key);
  if (!source) throw new Error(`unknown seed exercise: ${key}`);
  const snapshot = snapshotFor(key, atTime);
  const base = source.bodyweight
    ? 0
    : roundTo(source.baseWeightKg + source.progressPerWeek * weekIndex, 1);

  const setList: StrengthSet[] = [];
  for (let s = 0; s < plannedSets; s += 1) {
    // Fatigue: later sets lose reps and, under load, weight.
    const reps = Math.max(3, (REP_LADDER[Math.min(REP_LADDER.length - 1, s)] ?? 8) - Math.floor(rng() * 2));
    const weightKg = source.bodyweight
      ? 0
      : roundTo(Math.max(2.5, base - s * (base > 60 ? 2.5 : 1) + (rng() - 0.5) * 2.5), 1);
    // A few missed sets across the whole history: a perfect log is obviously fake.
    const completed = rng() > 0.045;
    setList.push({
      index: s + 1,
      reps,
      weightKg,
      completed,
      estimated1rm: estimatedOneRepMax(weightKg, reps),
      rpe: completed ? Math.round(randomInRange(rng, 7, 10)) : null,
    });
  }

  return {
    exerciseId: snapshot.exerciseId,
    exerciseName: snapshot.name,
    muscleGroup: source.primary[0] ?? null,
    sets: setList,
    notes: null,
    restSeconds: source.restSeconds,
  };
}

/* ------------------------------------------------------------- builders -- */

function buildStrengthActivity(
  rng: () => number,
  plan: PlanTemplate,
  weekIndex: number,
  startedAt: number,
): Activity {
  const entries = plan.keys.map((key, i) =>
    buildEntry(key, weekIndex, plan.sets[i] ?? 3, rng, startedAt),
  );
  const volume = totalVolumeKg(entries);
  // ~4 minutes of work-and-rest per 260 kg of volume: not a real physiological
  // model, just one that produces durations nobody questions.
  const durationSeconds = 2100 + Math.round(volume / 260) * 60;
  return {
    id: localId('seed'),
    kind: 'lift',
    title: plan.name,
    startedAt,
    durationSeconds,
    caloriesKcal: Math.round(estimateCalories(durationSeconds)),
    notes: null,
    seeded: true,
    sourceSessionId: null,
    strength: {
      entries,
      totalVolumeKg: volume,
      totalSets: entries.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0),
      personalRecords: [],
    },
  };
}

/**
 * Thirteen weeks, ending *in the present*: push, pull and legs on Monday, Wednesday and
 * Friday, rotating through the three plans, plus one near-empty travel week so streak breaks
 * and sparse weeks are visible rather than hypothetical.
 *
 * ## Why the last loop is a repeat, not a new week
 *
 * The window runs Monday-to-Monday and its last week is the one the user is
 * standing in. Laying the normal schedule across it would date a Friday lift
 * *after* today, and `push` would then drop it: leaving a visible, empty current
 * week while the weeks behind it look busy. So the final loop reuses the previous
 * week's plan and progression index: same shape, shifted into the past, and every
 * session it schedules has either happened or is honestly yet to come.
 */
function buildHistory(rng: () => number): Activity[] {
  const activities: Activity[] = [];
  const today = startOfDay(Date.now());
  // `-(WEEKS - 1)` because week 0 and week WEEKS-1 are both Mondays *inside* the
  // window: thirteen Mondays, thirteen weeks, the last one today's.
  const firstMonday = startOfWeek(addDays(today, -(WEEKS - 1) * 7));
  /** Week 6 is a travel week: almost nothing logged. */
  const TRAVEL_WEEK = 6;

  const push = (activity: Activity) => {
    // `< today + 1 day`, not `< today`: an evening session scheduled on today's
    // own date is still in the window, and dropping it would thin out the very
    // week the app is being opened in. Nothing later than today can get through.
    if (activity.startedAt <= today.getTime() + 86_400_000) activities.push(activity);
  };

  for (let week = 0; week < WEEKS; week += 1) {
    const weekStart = addDays(firstMonday, week * 7);
    // The plan/progression index this loop copies. Only differs from `week` on the final
    // loop, where reusing the last full week keeps the trend line monotonic without
    // inventing a future session.
    const source = week === WEEKS - 1 ? week - 1 : week;
    const travel = source === TRAVEL_WEEK;

    // Monday, Wednesday and Friday; a single Wednesday session in the travel week.
    const days = travel ? [2] : [0, 2, 4];
    days.forEach((offset, index) => {
      const plan = PLANS[(source + index) % PLANS.length];
      if (!plan) return;
      push(
        buildStrengthActivity(
          rng,
          plan,
          source,
          addDays(weekStart, offset).getTime() + 19 * 3_600_000,
        ),
      );
    });
  }

  return activities.sort((a, b) => a.startedAt - b.startedAt);
}

function buildRoutines(createdAt: number): Routine[] {
  return PLANS.map((plan) => ({
    id: localId('seed'),
    name: plan.name,
    description: plan.description,
    // The date history *starts* on, not `now - WEEKS weeks`: that subtraction
    // used `WEEKS` as a duration on a quantity that is a count of Mondays, which
    // put creation exactly one week before anything was ever trained.
    createdAt,
    // Two days ago rather than today, so "last trained" is a plausible recent
    // number instead of "just now" on an app that has never recorded a session.
    updatedAt: startOfDay(Date.now()).getTime() - 2 * 86_400_000,
    // Completion counts are back-filled from history so "performed 9×" is true.
    timesCompleted: 0,
    lastPerformedAt: null,
    seeded: true,
    items: plan.keys.map<RoutineItem>((key, index) => {
      const source = exerciseByKey.get(key);
      // `snapshotFor` caches by key and history runs first, so this date is a
      // fallback rather than the value that usually survives: but it must still
      // be a date the routine could have known about, which `createdAt` is.
      const snapshot = snapshotFor(key, createdAt);
      return {
        id: localId('seed'),
        exerciseId: snapshot.exerciseId,
        exerciseName: snapshot.name,
        sets: plan.sets[index] ?? 3,
        reps: index === 0 ? '5' : '8-10',
        weightKg: source?.bodyweight ? 0 : roundTo(source?.baseWeightKg ?? 20, 1),
        restSeconds: source?.restSeconds ?? 90,
        notes: null,
      };
    }),
  }));
}

/** Best-ever values per exercise, derived from the history we just generated. */
function buildRecords(activities: readonly Activity[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  const consider = (record: PersonalRecord) => {
    const key = `${record.exerciseId}:${record.kind}`;
    const current = best.get(key);
    if (!current || record.value > current.value) best.set(key, record);
  };

  for (const activity of activities) {
    for (const entry of activity.strength?.entries ?? []) {
      consider({
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        kind: 'volume',
        value: entryVolumeKg(entry),
        achievedAt: activity.startedAt,
        previousValue: null,
      });

      let maxReps = 0;
      for (const set of entry.sets) {
        if (!set.completed) continue;
        maxReps = Math.max(maxReps, set.reps);
        if (set.estimated1rm !== null) {
          consider({
            exerciseId: entry.exerciseId,
            exerciseName: entry.exerciseName,
            kind: 'est1rm',
            value: set.estimated1rm,
            achievedAt: activity.startedAt,
            previousValue: null,
          });
        }
      }
      if (maxReps > 0) {
        consider({
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          kind: 'maxReps',
          value: maxReps,
          achievedAt: activity.startedAt,
          previousValue: null,
        });
      }
    }
  }
  return [...best.values()];
}

/** Counts each plan's completions from history so routine stats aren't zero. */
function applyCompletionStats(routines: Routine[], activities: readonly Activity[]): void {
  for (const routine of routines) {
    const matches = activities.filter(
      (activity) => activity.kind === 'lift' && activity.title === routine.name,
    );
    routine.timesCompleted = matches.length;
    routine.lastPerformedAt = matches.at(-1)?.startedAt ?? null;
  }
}

/* ----------------------------------------------------------------- entry -- */

/**
 * Populates a virgin database. Idempotent: `isEmpty` means a second call is a
 * no-op, so a remount or hot reload can never double-seed.
 *
 * A database that is empty because the user erased it, or deleted every activity, is not
 * virgin: `SEED_DONE_KEY` records that the seed already had its chance. An install that
 * predates the marker gets it on its first launch with data.
 */
export async function seedIfEmpty(): Promise<SeedResult | null> {
  if (await readState(SEED_DONE_KEY, false)) return null;
  if (!(await activityRepository.isEmpty())) {
    await writeState(SEED_DONE_KEY, true);
    return null;
  }

  const rng = createRandom(0x5eed_71);
  const now = Date.now();

  const activities = buildHistory(rng);
  const routines = buildRoutines(activities[0]?.startedAt ?? now);
  applyCompletionStats(routines, activities);
  const records = buildRecords(activities);

  // Snapshots first: routine_items references exercises ON DELETE RESTRICT.
  for (const snapshot of snapshots.values()) await upsertSnapshot(snapshot);

  for (const routine of routines) {
    const plan = PLANS.find((p) => p.name === routine.name);
    await routineRepository.save({
      id: routine.id,
      name: routine.name,
      description: routine.description,
      items: routine.items,
      snapshots: (plan?.keys ?? []).map((key) => snapshotFor(key, now)),
    });
    await routineRepository.backfillStats(routine.id, {
      timesCompleted: routine.timesCompleted,
      lastPerformedAt: routine.lastPerformedAt,
      createdAt: routine.createdAt,
      updatedAt: routine.updatedAt,
    });
  }

  await activityRepository.insertMany(activities);
  await recordRepository.replaceAll(records);

  await setSetting(SETTING_KEYS.weeklyGoalWorkouts, 3);
  await setSetting(SETTING_KEYS.defaultRestSeconds, 120);
  await writeState(SEED_DONE_KEY, true);

  return {
    activities: activities.length,
    routines: routines.length,
    exercises: snapshots.size,
    records: records.length,
    firstActivityAt: activities[0]?.startedAt ?? now,
  };
}

/** Exposed so tests can reason about which exercises the seed owns. */
export const SEED_EXERCISE_IDS: readonly string[] = SEED_EXERCISES.map(
  (e) => `local:${e.key}`,
);
