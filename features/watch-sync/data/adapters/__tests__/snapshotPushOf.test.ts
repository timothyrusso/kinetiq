import { aRoutine } from '@/features/watch-sync/__fixtures__/routines';
import { buildWatchRoutines } from '@/features/watch-sync/data/adapters/buildWatchRoutines';
import { snapshotPushOf } from '@/features/watch-sync/data/adapters/snapshotPushOf';

const aPush = (overrides: Partial<Parameters<typeof snapshotPushOf>[0]> = {}) => ({
  routines: [aRoutine()],
  unitSystem: 'metric' as const,
  at: new Date('2026-09-25T10:00:00.000Z'),
  force: false,
  requestId: null,
  ...overrides,
});

describe('snapshotPushOf', () => {
  it('sends the document as the JSON the watch reads', () => {
    const push = aPush();

    expect(JSON.parse(snapshotPushOf(push).payload)).toEqual(buildWatchRoutines(push.routines, 'metric', push.at));
  });

  it('names the push after its time, in base 36', () => {
    expect(snapshotPushOf(aPush()).id).toBe(`snap-${new Date('2026-09-25T10:00:00.000Z').getTime().toString(36)}`);
  });

  it('keys the same routines alike at any time, so the watch drops a push it already has', () => {
    const later = snapshotPushOf(aPush({ at: new Date('2026-09-26T08:00:00.000Z') }));

    expect(later.contentKey).toBe(snapshotPushOf(aPush()).contentKey);
  });

  it('keys changed routines differently', () => {
    const renamed = snapshotPushOf(aPush({ routines: [aRoutine({ name: 'Pull' })] }));

    expect(renamed.contentKey).not.toBe(snapshotPushOf(aPush()).contentKey);
  });

  it('keys another unit setting differently, since the watch shows weights in it', () => {
    expect(snapshotPushOf(aPush({ unitSystem: 'imperial' })).contentKey).not.toBe(snapshotPushOf(aPush()).contentKey);
  });

  it('passes the force flag and the request it answers', () => {
    expect(snapshotPushOf(aPush({ force: true, requestId: 'req-1' }))).toMatchObject({
      force: true,
      requestId: 'req-1',
    });
  });
});
