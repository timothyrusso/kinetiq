import { Effect, Exit, Layer } from 'effect';
import { SqlError } from '@/features/core/error';
import { type ExerciseSnapshot, ExerciseSnapshotRepository } from '@/features/exercises';
import type { RoutineUpdate } from '@/features/workouts/domain/entities/RoutineUpdate';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import { RecordRepository } from '@/features/workouts/domain/repositories/RecordRepository';
import { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { RoutineUsage } from '@/features/workouts/domain/services/RoutineUsage';
import { WorkoutTransaction } from '@/features/workouts/domain/services/WorkoutTransaction';
import { completedSetCount, totalVolumeKg } from '@/features/workouts/domain/utils/workoutMath';

type ActivityService = (typeof ActivityRepository)['Service'];
type RecordService = (typeof RecordRepository)['Service'];
type SessionService = (typeof SessionRepository)['Service'];

/** What the fakes store, in one place, so a fake transaction can roll all of it back. */
export interface FakeWorkoutsDb {
  activities: Map<string, Activity>;
  records: Map<string, PersonalRecord>;
  sessions: Map<string, WorkoutSession>;
  snapshots: Map<string, ExerciseSnapshot>;
  /** Every workout counted against a routine, in order. */
  routinesUsed: { routineId: string; performedAt: number }[];
  /** Every workout written back into its routine, in order. */
  routinesUpdated: RoutineUpdate[];
}

export const makeFakeWorkoutsDb = (seed: Partial<FakeWorkoutsDb> = {}): FakeWorkoutsDb => ({
  activities: new Map(),
  records: new Map(),
  sessions: new Map(),
  snapshots: new Map(),
  routinesUsed: [],
  routinesUpdated: [],
  ...seed,
});

/** Which method of which fake fails with a `SqlError` instead. */
export interface FakeFailures {
  readonly activities?: keyof ActivityService;
  readonly records?: keyof RecordService;
  readonly sessions?: keyof SessionService;
  readonly snapshots?: 'upsert';
  readonly routineUsage?: true;
  /** Only the write-back into the routine fails. */
  readonly routineUpdate?: true;
}

const failure = (method: string) => Effect.fail(new SqlError({ message: `fake ${method} failed` }));

/** `run`, or a `SqlError` when `method` is the one set to fail. */
const orFail = <A>(failing: string | undefined, method: string, run: () => A) =>
  failing === method ? failure(method) : Effect.sync(run);

const byStart = (order: 'asc' | 'desc') => (a: Activity, b: Activity) => {
  const sign = order === 'asc' ? 1 : -1;
  if (a.startedAt !== b.startedAt) return sign * (a.startedAt - b.startedAt);
  return sign * a.id.localeCompare(b.id);
};

const recordKey = (record: PersonalRecord) => `${record.exerciseId}:${record.kind}`;

const activityRepositoryFake = (db: FakeWorkoutsDb, failing?: keyof ActivityService) =>
  Layer.sync(
    ActivityRepository,
    (): ActivityService => ({
      list: (query = {}) =>
        orFail(failing, 'list', () => {
          const rows = [...db.activities.values()]
            .filter(activity => query.from === undefined || activity.startedAt >= query.from)
            .filter(activity => query.to === undefined || activity.startedAt <= query.to)
            .sort(byStart(query.order ?? 'desc'));
          const offset = query.offset ?? 0;
          return rows.slice(offset, query.limit === undefined ? undefined : offset + query.limit);
        }),
      byId: id => orFail(failing, 'byId', () => db.activities.get(id)),
      count: orFail(failing, 'count', () => db.activities.size),
      remove: id => orFail(failing, 'remove', () => void db.activities.delete(id)),
      recordWorkout: (workout, records) =>
        orFail(failing, 'recordWorkout', () => {
          const activity: Activity = {
            id: workout.id,
            kind: 'lift',
            title: workout.title.trim() || 'Strength session',
            startedAt: workout.startedAt,
            durationSeconds: workout.durationSeconds,
            notes: workout.notes,
            sourceSessionId: workout.id,
            strength: {
              entries: workout.entries,
              totalVolumeKg: totalVolumeKg(workout.entries),
              totalSets: completedSetCount(workout.entries),
              personalRecords: [...records],
            },
          };
          db.activities.set(activity.id, activity);
          return activity;
        }),
    }),
  );

const recordRepositoryFake = (db: FakeWorkoutsDb, failing?: keyof RecordService) =>
  Layer.sync(
    RecordRepository,
    (): RecordService => ({
      forExercise: exerciseId =>
        orFail(failing, 'forExercise', () =>
          [...db.records.values()].filter(record => record.exerciseId === exerciseId),
        ),
      upsertBests: records =>
        orFail(failing, 'upsertBests', () => {
          for (const record of records) {
            const stored = db.records.get(recordKey(record));
            if (stored === undefined || record.value > stored.value) {
              db.records.set(recordKey(record), { ...record, previousValue: null });
            }
          }
        }),
    }),
  );

const sessionRepositoryFake = (db: FakeWorkoutsDb, failing?: keyof SessionService) =>
  Layer.sync(
    SessionRepository,
    (): SessionService => ({
      save: session => orFail(failing, 'save', () => void db.sessions.set(session.id, session)),
      byId: id => orFail(failing, 'byId', () => db.sessions.get(id)),
      active: orFail(
        failing,
        'active',
        () =>
          [...db.sessions.values()]
            .filter(session => session.status === 'active' || session.status === 'paused')
            .sort((a, b) => b.updatedAt - a.updatedAt)[0],
      ),
      clearRest: id =>
        orFail(failing, 'clearRest', () => {
          const session = db.sessions.get(id);
          if (session) db.sessions.set(id, { ...session, restEndsAt: null, restDurationSeconds: null });
        }),
      setStatus: (id, status) =>
        orFail(failing, 'setStatus', () => {
          const session = db.sessions.get(id);
          if (session) db.sessions.set(id, { ...session, status });
        }),
      remove: id => orFail(failing, 'remove', () => void db.sessions.delete(id)),
    }),
  );

/** Copies every table, so a failed transaction can put them back. */
const snapshotOf = (db: FakeWorkoutsDb) => ({
  activities: new Map(db.activities),
  records: new Map(db.records),
  sessions: new Map(db.sessions),
  snapshots: new Map(db.snapshots),
  routinesUsed: [...db.routinesUsed],
  routinesUpdated: [...db.routinesUpdated],
});

/** A transaction over the fakes: a failure puts every table back as it was before it began. */
const workoutTransactionFake = (db: FakeWorkoutsDb) =>
  Layer.succeed(WorkoutTransaction, {
    atomically: effect =>
      Effect.gen(function* () {
        const before = snapshotOf(db);
        const exit = yield* Effect.exit(effect);
        if (Exit.isFailure(exit)) Object.assign(db, before);
        return yield* exit;
      }),
  });

const routineUsageFake = (db: FakeWorkoutsDb, failing?: true, updateFailing?: true) =>
  Layer.succeed(RoutineUsage, {
    markUsed: (routineId, performedAt) =>
      failing ? failure('markUsed') : Effect.sync(() => void db.routinesUsed.push({ routineId, performedAt })),
    applyWorkout: update =>
      failing || updateFailing ? failure('applyWorkout') : Effect.sync(() => void db.routinesUpdated.push(update)),
  });

const snapshotRepositoryFake = (db: FakeWorkoutsDb, failing?: 'upsert') =>
  Layer.succeed(ExerciseSnapshotRepository, {
    byId: exerciseId => Effect.sync(() => db.snapshots.get(exerciseId)),
    byIds: exerciseIds =>
      Effect.sync(
        () =>
          new Map(
            exerciseIds.flatMap(id => {
              const snapshot = db.snapshots.get(id);
              return snapshot === undefined ? [] : [[id, snapshot] as const];
            }),
          ),
      ),
    byName: name => Effect.sync(() => [...db.snapshots.values()].find(snapshot => snapshot.name === name)),
    upsert: snapshot =>
      failing === 'upsert'
        ? failure('upsert')
        : Effect.sync(() => void db.snapshots.set(snapshot.exerciseId, snapshot)),
  });

/**
 * Every service the workouts' use cases need, over `db`. `failing` names the one method of each
 * that fails with a `SqlError`; the rest stay real.
 */
export const makeWorkoutsFake = (db: FakeWorkoutsDb = makeFakeWorkoutsDb(), failing: FakeFailures = {}) =>
  Layer.mergeAll(
    activityRepositoryFake(db, failing.activities),
    recordRepositoryFake(db, failing.records),
    sessionRepositoryFake(db, failing.sessions),
    workoutTransactionFake(db),
    routineUsageFake(db, failing.routineUsage, failing.routineUpdate),
    snapshotRepositoryFake(db, failing.snapshots),
  );
