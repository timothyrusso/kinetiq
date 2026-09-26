import type { Activity, CompletedWorkout } from '@/domain/types';
import { commitWorkout } from '../commitWorkout';

jest.mock('@/persistence', () => {
  const store = { activities: new Map<string, unknown>(), inTransaction: false };
  return {
    mockStore: store,
    withTransaction: jest.fn(async (task: () => Promise<void>) => {
      store.inTransaction = true;
      try {
        await task();
      } finally {
        store.inTransaction = false;
      }
    }),
    activityRepository: {
      byId: jest.fn(async (id: string) => store.activities.get(id) ?? null),
      list: jest.fn(async () => [...store.activities.values()]),
      recordWorkout: jest.fn(async (workout: { id: string; startedAt: number; entries: unknown[] }, records: unknown[]) => {
        const activity = {
          id: workout.id,
          startedAt: workout.startedAt,
          strength: { entries: workout.entries, personalRecords: records },
        };
        store.activities.set(workout.id, activity);
        return activity;
      }),
    },
    recordRepository: { commitManyInTransaction: jest.fn(async () => {}) },
    routineRepository: { markPerformed: jest.fn(async () => {}) },
  };
});

const persistence = jest.requireMock('@/persistence') as {
  mockStore: { activities: Map<string, Activity>; inTransaction: boolean };
  activityRepository: { list: jest.Mock; recordWorkout: jest.Mock };
  recordRepository: { commitManyInTransaction: jest.Mock };
  routineRepository: { markPerformed: jest.Mock };
};

const workout = (overrides: Partial<CompletedWorkout> = {}): CompletedWorkout => ({
  id: 'watch-1',
  routineId: 'rtn_1',
  title: 'Push',
  startedAt: 1_000,
  endedAt: 2_000,
  durationSeconds: 1,
  caloriesKcal: 0,
  entries: [
    {
      exerciseId: 'wger:73',
      exerciseName: 'Bench',
      muscleGroup: null,
      restSeconds: 60,
      notes: null,
      sets: [{ index: 0, reps: 5, weightKg: 100, completed: true, estimated1rm: 116.5, rpe: null }],
    },
  ],
  totalVolumeKg: 500,
  totalSets: 1,
  notes: null,
  ...overrides,
});

beforeEach(() => {
  persistence.mockStore.activities.clear();
  jest.clearAllMocks();
});

describe('commitWorkout', () => {
  it('detects PRs against the history before it and writes everything in one transaction', async () => {
    persistence.recordRepository.commitManyInTransaction.mockImplementationOnce(async () => {
      expect(persistence.mockStore.inTransaction).toBe(true);
    });
    const result = await commitWorkout(workout());
    expect(result?.personalRecords.map((r) => r.kind)).toEqual(['est1rm']);
    expect(persistence.recordRepository.commitManyInTransaction).toHaveBeenCalledWith(result?.personalRecords);
    expect(persistence.routineRepository.markPerformed).toHaveBeenCalledWith('rtn_1', 2_000);
  });

  it('treats a workout already in history as saved: no second insert, PRs or routine count', async () => {
    await commitWorkout(workout());
    jest.clearAllMocks();
    await expect(commitWorkout(workout())).resolves.toBeNull();
    expect(persistence.activityRepository.list).not.toHaveBeenCalled();
    expect(persistence.activityRepository.recordWorkout).not.toHaveBeenCalled();
    expect(persistence.recordRepository.commitManyInTransaction).not.toHaveBeenCalled();
    expect(persistence.routineRepository.markPerformed).not.toHaveBeenCalled();
  });

  it('marks the routine for a phone session the same as for a watch workout', async () => {
    await commitWorkout(workout({ id: 'session-1', endedAt: 5_000 }));
    expect(persistence.routineRepository.markPerformed).toHaveBeenCalledWith('rtn_1', 5_000);
  });

  it('marks nothing for a workout without a routine', async () => {
    await commitWorkout(workout({ id: 'session-2', routineId: null }));
    expect(persistence.routineRepository.markPerformed).not.toHaveBeenCalled();
  });

  it('lets a failed save propagate so the caller keeps the payload', async () => {
    persistence.recordRepository.commitManyInTransaction.mockRejectedValueOnce(new Error('disk full'));
    await expect(commitWorkout(workout())).rejects.toThrow('disk full');
  });
});
