import { Effect, Either, TestClock } from 'effect';
import { itEffect } from '@/features/core/testing';
import {
  anActivity,
  anExercise,
  aPlan,
  aSession,
  plannedSets,
  WORKOUT_TIME,
} from '@/features/workouts/__fixtures__/builders';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { makeFakeWorkoutsDb, makeWorkoutsFake } from '@/features/workouts/useCases/__tests__/workoutFakes';
import { addSessionExercise } from '@/features/workouts/useCases/addSessionExercise';
import { discardSession } from '@/features/workouts/useCases/discardSession';
import { finishSession } from '@/features/workouts/useCases/finishSession';
import { hydrateSession } from '@/features/workouts/useCases/hydrateSession';
import { persistSession } from '@/features/workouts/useCases/persistSession';
import { startSession } from '@/features/workouts/useCases/startSession';

const ID = ActivityId.make('session-mbz1a2b3');
const FINISHED_AT = WORKOUT_TIME + 2_700_000;

describe('startSession', () => {
  itEffect(
    'builds the session the plan starts, at the time it starts, without writing it',
    Effect.gen(function* () {
      yield* TestClock.setTime(WORKOUT_TIME);

      const session = yield* startSession(aPlan(), null);

      expect(session).toMatchObject({ startedAt: WORKOUT_TIME, routineName: 'Push Day', status: 'active' });
    }),
  );

  itEffect(
    'fails with SessionAlreadyActive while another workout is in progress',
    Effect.gen(function* () {
      const result = yield* Effect.either(startSession(aPlan(), aSession({ status: 'paused' })));

      expect(Either.isLeft(result) && result.left._tag).toBe('SessionAlreadyActive');
    }),
  );
});

describe('hydrateSession', () => {
  itEffect(
    'restores the session in progress',
    Effect.gen(function* () {
      expect((yield* hydrateSession)?.id).toBe(ID);
    }),
    makeWorkoutsFake(makeFakeWorkoutsDb({ sessions: new Map([[ID, aSession()]]) })),
  );

  itEffect(
    'restores nothing when the last workout was finished',
    Effect.gen(function* () {
      expect(yield* hydrateSession).toBeNull();
    }),
    makeWorkoutsFake(makeFakeWorkoutsDb({ sessions: new Map([[ID, aSession({ status: 'finished' })]]) })),
  );
});

describe('persistSession', () => {
  const saved = makeFakeWorkoutsDb();
  itEffect(
    'writes the whole session',
    Effect.gen(function* () {
      yield* persistSession({ kind: 'save', session: aSession() });

      expect(saved.sessions.get(ID)).toEqual(aSession());
    }),
    makeWorkoutsFake(saved),
  );

  const resting = makeFakeWorkoutsDb({
    sessions: new Map([[ID, aSession({ restEndsAt: 1, restDurationSeconds: 90 })]]),
  });
  itEffect(
    'clears only the rest of a skipped rest',
    Effect.gen(function* () {
      yield* persistSession({ kind: 'clearRest', sessionId: ID });

      expect(resting.sessions.get(ID)).toMatchObject({
        restEndsAt: null,
        restDurationSeconds: null,
        elapsedSeconds: 600,
      });
    }),
    makeWorkoutsFake(resting),
  );

  const refused = makeFakeWorkoutsDb();
  itEffect(
    'fails with SessionPersistFailed when the write fails, and stores nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(persistSession({ kind: 'save', session: aSession() }));

      expect(Either.isLeft(result) && result.left._tag).toBe('SessionPersistFailed');
      expect(refused.sessions.size).toBe(0);
    }),
    makeWorkoutsFake(refused, { sessions: 'save' }),
  );
});

describe('finishSession', () => {
  const finishing = makeFakeWorkoutsDb({ sessions: new Map([[ID, aSession()]]) });
  itEffect(
    'marks the session finished and records it as a workout of the time it counted',
    Effect.gen(function* () {
      yield* TestClock.setTime(FINISHED_AT);

      const result = yield* finishSession(ID, aSession(), 3, false);

      expect(finishing.sessions.get(ID)?.status).toBe('finished');
      expect(finishing.activities.get(ID)).toMatchObject({ durationSeconds: 600, title: 'Push Day' });
      expect(result.activity.id).toBe(ID);
      expect(finishing.routinesUsed).toEqual([{ routineId: 'rtn_push', performedAt: FINISHED_AT }]);
    }),
    makeWorkoutsFake(finishing),
  );

  itEffect(
    'records the stored session when the one in memory is another',
    Effect.gen(function* () {
      const result = yield* finishSession(ID, null, 3, false);

      expect(result.activity.id).toBe(ID);
    }),
    makeWorkoutsFake(makeFakeWorkoutsDb({ sessions: new Map([[ID, aSession()]]) })),
  );

  const gone = makeFakeWorkoutsDb();
  itEffect(
    'fails with NoActiveSession for a session that is gone, and records nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(finishSession(ID, null, 3, false));

      expect(Either.isLeft(result) && result.left._tag).toBe('NoActiveSession');
      expect(gone.activities.size).toBe(0);
    }),
    makeWorkoutsFake(gone),
  );

  const replayed = makeFakeWorkoutsDb({
    sessions: new Map([[ID, aSession()]]),
    activities: new Map([[ID, anActivity()]]),
  });
  itEffect(
    'fails with DuplicateWorkout for a session already in history, leaving it finished',
    Effect.gen(function* () {
      const result = yield* Effect.either(finishSession(ID, aSession(), 3, false));

      expect(Either.isLeft(result) && result.left._tag).toBe('DuplicateWorkout');
      expect(replayed.sessions.get(ID)?.status).toBe('finished');
    }),
    makeWorkoutsFake(replayed),
  );

  const third = makeFakeWorkoutsDb({
    sessions: new Map([[ID, aSession({ startedAt: WORKOUT_TIME })]]),
    activities: new Map(
      ['a', 'b'].map(id => [id, anActivity({ id: ActivityId.make(id), startedAt: WORKOUT_TIME - 3_600_000 })]),
    ),
  });
  itEffect(
    'says a finish met the weekly goal when it is the goal-th workout of the week and set no record',
    Effect.gen(function* () {
      yield* TestClock.setTime(FINISHED_AT);

      const result = yield* finishSession(ID, aSession({ entries: [] }), 3, false);

      expect(result.closedWeeklyGoal).toBe(true);
    }),
    makeWorkoutsFake(third),
  );

  itEffect(
    'does not ask about the goal when the workout set a record',
    Effect.gen(function* () {
      yield* TestClock.setTime(FINISHED_AT);

      const result = yield* finishSession(ID, aSession(), 1, false);

      expect(result.personalRecords).not.toHaveLength(0);
      expect(result.closedWeeklyGoal).toBe(false);
    }),
    makeWorkoutsFake(makeFakeWorkoutsDb({ sessions: new Map([[ID, aSession()]]) })),
  );
});

describe('finishSession with "Update routine with today\'s values"', () => {
  const fromRoutine = aSession({ routineItemIds: ['rit_bench', 'rit_press'] });
  const withRoutine = () => makeFakeWorkoutsDb({ sessions: new Map([[ID, fromRoutine]]) });

  const on = withRoutine();
  itEffect(
    'writes the workout as it ended back into its routine, with the items it started with',
    Effect.gen(function* () {
      yield* finishSession(ID, fromRoutine, 3, true);

      expect(on.routinesUpdated).toEqual([
        { routineId: 'rtn_push', plannedItemIds: ['rit_bench', 'rit_press'], entries: fromRoutine.entries },
      ]);
      expect(on.activities.has(ID)).toBe(true);
    }),
    makeWorkoutsFake(on),
  );

  const off = withRoutine();
  itEffect(
    'writes nothing back with the switch off, and still records the workout and counts the routine',
    Effect.gen(function* () {
      yield* finishSession(ID, fromRoutine, 3, false);

      expect(off.routinesUpdated).toEqual([]);
      expect(off.activities.has(ID)).toBe(true);
      expect(off.routinesUsed).toHaveLength(1);
    }),
    makeWorkoutsFake(off),
  );

  const freeform = makeFakeWorkoutsDb({ sessions: new Map([[ID, aSession({ routineId: null })]]) });
  itEffect(
    'writes nothing back for a workout that did not start from a routine',
    Effect.gen(function* () {
      yield* finishSession(ID, aSession({ routineId: null }), 3, true);

      expect(freeform.routinesUpdated).toEqual([]);
    }),
    makeWorkoutsFake(freeform),
  );

  const legacy = makeFakeWorkoutsDb({ sessions: new Map([[ID, aSession()]]) });
  itEffect(
    'writes nothing back for a session started before it knew its routine items',
    Effect.gen(function* () {
      yield* finishSession(ID, aSession(), 3, true);

      expect(legacy.routinesUpdated).toEqual([]);
    }),
    makeWorkoutsFake(legacy),
  );

  const refused = withRoutine();
  itEffect(
    'records nothing when the routine cannot be updated: the workout and its routine roll back together',
    Effect.gen(function* () {
      const result = yield* Effect.either(finishSession(ID, fromRoutine, 3, true));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(refused.activities.size).toBe(0);
      expect(refused.routinesUsed).toEqual([]);
    }),
    makeWorkoutsFake(refused, { routineUpdate: true }),
  );
});

describe('discardSession', () => {
  const discarding = makeFakeWorkoutsDb({ sessions: new Map([[ID, aSession()]]) });
  itEffect(
    'deletes the session, so nothing is restored',
    Effect.gen(function* () {
      yield* discardSession(ID);

      expect(discarding.sessions.size).toBe(0);
      expect(discarding.activities.size).toBe(0);
    }),
    makeWorkoutsFake(discarding),
  );

  const stuck = makeFakeWorkoutsDb({ sessions: new Map([[ID, aSession()]]) });
  itEffect(
    'fails with SqlError when the row cannot be deleted, which keeps it',
    Effect.gen(function* () {
      const result = yield* Effect.either(discardSession(ID));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(stuck.sessions.size).toBe(1);
    }),
    makeWorkoutsFake(stuck, { sessions: 'remove' }),
  );
});

describe('addSessionExercise', () => {
  const TARGET = { sets: plannedSets(3, 8, 0), restSeconds: 120, notes: null };

  const stored = makeFakeWorkoutsDb();
  itEffect(
    'stores the exercise and builds its entry like a planned one',
    Effect.gen(function* () {
      yield* TestClock.setTime(WORKOUT_TIME);

      const entry = yield* addSessionExercise(anExercise(), TARGET);

      expect(stored.snapshots.get('ex:barbell-bench-press')).toMatchObject({
        name: 'Bench Press',
        capturedAt: WORKOUT_TIME,
      });
      expect(entry).toMatchObject({
        exerciseId: 'ex:barbell-bench-press',
        exerciseName: 'Bench Press',
        restSeconds: 120,
      });
      expect(entry.sets.map(set => set.reps)).toEqual([8, 8, 8]);
    }),
    makeWorkoutsFake(stored),
  );

  itEffect(
    'fails with SqlError when the exercise cannot be stored',
    Effect.gen(function* () {
      const result = yield* Effect.either(addSessionExercise(anExercise(), TARGET));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
    }),
    makeWorkoutsFake(makeFakeWorkoutsDb(), { snapshots: 'upsert' }),
  );
});
