import { Effect } from 'effect';
import { advanceClock, itEffect } from '@/features/core/testing';
import type { Routine } from '@/features/routines';
import { aRoutine } from '@/features/watch-sync/__fixtures__/routines';
import type { SnapshotPush } from '@/features/watch-sync/domain/entities/SnapshotPush';
import { RoutineRepositoryFake } from '@/features/watch-sync/useCases/__tests__/routineRepositoryFake';
import { pushRoutineSnapshot } from '@/features/watch-sync/useCases/pushRoutineSnapshot';

describe('pushRoutineSnapshot', () => {
  itEffect(
    'sends every routine in the unit setting, stamped with the time now',
    Effect.gen(function* () {
      const sent: SnapshotPush<Routine>[] = [];
      yield* advanceClock('1 hour');

      yield* pushRoutineSnapshot(push => Effect.sync(() => void sent.push(push)), 'imperial');

      expect(sent).toEqual([
        { routines: [aRoutine()], unitSystem: 'imperial', at: new Date(3_600_000), force: false, requestId: null },
      ]);
    }),
    RoutineRepositoryFake([aRoutine()]),
  );

  itEffect(
    'forces the push and names the request when the watch asked for it',
    Effect.gen(function* () {
      const sent: SnapshotPush<Routine>[] = [];

      yield* pushRoutineSnapshot(push => Effect.sync(() => void sent.push(push)), 'metric', {
        force: true,
        requestId: 'req-1',
      });

      expect(sent.map(push => [push.force, push.requestId])).toEqual([[true, 'req-1']]);
    }),
    RoutineRepositoryFake([aRoutine()]),
  );
});
