import { Schema } from 'effect';
import {
  aCompletedWorkout,
  aDurationEntry,
  aDurationSet,
  anActivity,
  anEntry,
  aPlan,
  aRepsOnlyEntry,
  aRepsOnlySet,
  aSession,
  aSet,
} from '@/features/workouts/__fixtures__/builders';
import { ActivitySchema } from '@/features/workouts/domain/schemas/ActivitySchema';
import { CompletedWorkoutSchema } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';
import { SessionPlanSchema } from '@/features/workouts/domain/schemas/SessionPlanSchema';
import { StrengthEntrySchema } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { WorkoutSessionSchema } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';

describe('the workouts Schemas', () => {
  it('accept every builder as it is', () => {
    expect(Schema.decodeUnknownSync(ActivitySchema)(anActivity())).toEqual(anActivity());
    expect(Schema.decodeUnknownSync(WorkoutSessionSchema)(aSession())).toEqual(aSession());
    expect(Schema.decodeUnknownSync(CompletedWorkoutSchema)(aCompletedWorkout())).toEqual(aCompletedWorkout());
    expect(Schema.decodeUnknownSync(SessionPlanSchema)(aPlan())).toEqual(aPlan());
  });

  it('round-trips a session through its encoded form unchanged', () => {
    const encoded = Schema.encodeSync(WorkoutSessionSchema)(aSession());

    expect(Schema.decodeUnknownSync(WorkoutSessionSchema)(JSON.parse(JSON.stringify(encoded)))).toEqual(aSession());
  });

  it('reject a session with an empty id or a status the app does not know', () => {
    expect(Schema.is(WorkoutSessionSchema)({ ...aSession(), id: '' })).toBe(false);
    expect(Schema.is(WorkoutSessionSchema)({ ...aSession(), status: 'running' })).toBe(false);
  });

  it('reject a set whose reps are not a number', () => {
    expect(Schema.is(StrengthEntrySchema)({ ...anEntry(), sets: [{ ...aSet(), reps: '5' }] })).toBe(false);
  });

  it('accept an entry of each tracking type', () => {
    for (const entry of [anEntry(), aRepsOnlyEntry(), aDurationEntry()]) {
      expect(Schema.decodeUnknownSync(StrengthEntrySchema)(entry)).toEqual(entry);
    }
  });

  it('reject an entry holding a set of another type than its own', () => {
    expect(Schema.is(StrengthEntrySchema)({ ...anEntry(), sets: [aRepsOnlySet()] })).toBe(false);
    expect(Schema.is(StrengthEntrySchema)({ ...aRepsOnlyEntry(), sets: [aSet()] })).toBe(false);
    expect(Schema.is(StrengthEntrySchema)({ ...aDurationEntry(), sets: [aDurationSet(), aRepsOnlySet()] })).toBe(false);
  });

  it('reject a set without its type, and a type the app does not know', () => {
    const { type: _type, ...untagged } = aSet();
    expect(Schema.is(StrengthEntrySchema)({ ...anEntry(), sets: [untagged] })).toBe(false);
    expect(Schema.is(StrengthEntrySchema)({ ...anEntry(), trackingType: 'distance' })).toBe(false);
  });

  it('reject a timed set without its seconds', () => {
    const { durationSeconds: _seconds, ...noTime } = aDurationSet();
    expect(Schema.is(StrengthEntrySchema)({ ...aDurationEntry(), sets: [noTime] })).toBe(false);
  });

  it('reject a plan item holding a set of another type than its own', () => {
    const [item] = aPlan().items;
    expect(
      Schema.is(SessionPlanSchema)({
        ...aPlan(),
        items: [{ ...item, trackingType: 'duration' }],
      }),
    ).toBe(false);
  });

  it('reject an activity of a kind the app does not record', () => {
    expect(Schema.is(ActivitySchema)({ ...anActivity(), kind: 'run' })).toBe(false);
  });
});
