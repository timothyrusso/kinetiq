import { estimateCalories } from '@/domain/logic';
import { parseWatchWorkout } from '../parseWorkout';
import { document, entry, UUID } from './fixtures';

const withSet = (set: Record<string, unknown>) =>
  document({
    entries: [{ exerciseId: 'wger:73', exerciseName: 'Bench', restSeconds: 60, notes: null, sets: [set] }],
  });
const set = { index: 0, reps: 5, weightKg: 80, completed: true, rpe: null };

describe('parseWatchWorkout', () => {
  it('maps a valid payload to CompletedWorkout, computing what the phone computes', () => {
    const parsed = parseWatchWorkout(entry());
    if (!parsed.ok) throw new Error('expected ok');
    const { workout } = parsed;
    expect(workout.id).toBe(`watch-${UUID}`);
    expect(workout.routineId).toBe('rtn_1');
    expect(workout.durationSeconds).toBe(45 * 60);
    expect(workout.caloriesKcal).toBe(estimateCalories(45 * 60));
    expect(workout.totalSets).toBe(1);
    expect(workout.totalVolumeKg).toBe(400);
    expect(workout.entries[0]?.muscleGroup).toBeNull();
    expect(workout.entries[0]?.sets.map((s) => s.estimated1rm)).toEqual([93.5, null]);
  });

  it('accepts null fields, and an exercise the phone may no longer have', () => {
    const parsed = parseWatchWorkout(
      entry(document({ routineId: null, notes: null, entries: [{ exerciseId: 'local:deleted', exerciseName: 'Gone', restSeconds: 0, notes: null, sets: [set] }] })),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.workout.routineId).toBeNull();
      expect(parsed.workout.entries[0]?.sets[0]?.rpe).toBeNull();
    }
  });

  it('keeps an unknown version apart from bad data', () => {
    expect(parseWatchWorkout(entry(document(), { version: 2 }))).toEqual({ ok: false, reason: 'version' });
    expect(parseWatchWorkout(entry(document({ version: 2, entries: 'new shape' })))).toEqual({
      ok: false,
      reason: 'version',
    });
  });

  it('rejects out-of-bounds values', () => {
    for (const bad of [
      { ...set, weightKg: 451 },
      { ...set, weightKg: -1 },
      { ...set, reps: 101 },
      { ...set, reps: 2.5 },
      { ...set, completed: 'yes' },
      { ...set, rpe: 11 },
    ]) {
      expect(parseWatchWorkout(entry(withSet(bad)))).toEqual({ ok: false, reason: 'invalid' });
    }
    const longRest = document({
      entries: [{ exerciseId: 'x', exerciseName: 'X', restSeconds: 601, notes: null, sets: [set] }],
    });
    expect(parseWatchWorkout(entry(longRest)).ok).toBe(false);
    expect(parseWatchWorkout(entry(document({ endedAt: '2026-09-25T09:00:00.000Z' }))).ok).toBe(false);
    expect(parseWatchWorkout(entry(document({ endedAt: '2026-09-27T10:00:00.000Z' }))).ok).toBe(false);
  });

  it('rejects garbage, a missing field, a bad id and another format', () => {
    expect(parseWatchWorkout(entry('{"format": "kinetiq.watch-workout", "vers'))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseWatchWorkout(entry('', {}))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseWatchWorkout(entry(document({ title: undefined }))).ok).toBe(false);
    expect(parseWatchWorkout(entry(document({ id: '../../etc' }))).ok).toBe(false);
    expect(parseWatchWorkout(entry(document(), { format: 'kinetiq.routines' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseWatchWorkout(entry('x'.repeat(1_000_001))).ok).toBe(false);
  });
});
