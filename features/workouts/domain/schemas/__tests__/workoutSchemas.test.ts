import { Schema } from 'effect';
import { aCompletedWorkout, anActivity, aPlan, aSession, aSet } from '@/features/workouts/__fixtures__/builders';
import { ActivitySchema } from '@/features/workouts/domain/schemas/ActivitySchema';
import { CompletedWorkoutSchema } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';
import { SessionPlanSchema } from '@/features/workouts/domain/schemas/SessionPlanSchema';
import { StrengthSetSchema } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
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
    expect(Schema.is(StrengthSetSchema)({ ...aSet(), reps: '5' })).toBe(false);
  });

  it('reject an activity of a kind the app does not record', () => {
    expect(Schema.is(ActivitySchema)({ ...anActivity(), kind: 'run' })).toBe(false);
  });
});
