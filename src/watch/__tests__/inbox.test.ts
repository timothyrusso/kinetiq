import type { WatchInboxEntry } from '../../../modules/watch-bridge';
import { drainWatchInbox } from '../inbox';
import { document, entry, UUID } from './fixtures';

jest.mock('../../../modules/watch-bridge', () => {
  const entries: WatchInboxEntry[] = [];
  const remove = async (id: string) => {
    const index = entries.findIndex((e) => e.id === id);
    if (index >= 0) entries.splice(index, 1);
  };
  return {
    mockInbox: entries,
    watchBridge: {
      listInbox: jest.fn(async () => [...entries]),
      ackInbox: jest.fn(remove),
      rejectInbox: jest.fn(remove),
    },
  };
});
jest.mock('@/persistence', () => ({ openDatabase: jest.fn(async () => ({})) }));
jest.mock('@/workout/commitWorkout', () => ({ commitWorkout: jest.fn() }));
jest.mock('../inboxNotice', () => ({ reportWatchInboxProblem: jest.fn() }));

const { mockInbox, watchBridge: bridge } = jest.requireMock('../../../modules/watch-bridge') as {
  mockInbox: WatchInboxEntry[];
  watchBridge: { listInbox: jest.Mock; ackInbox: jest.Mock; rejectInbox: jest.Mock };
};
const { commitWorkout } = jest.requireMock('@/workout/commitWorkout') as { commitWorkout: jest.Mock };
const { reportWatchInboxProblem } = jest.requireMock('../inboxNotice') as { reportWatchInboxProblem: jest.Mock };

beforeEach(() => {
  mockInbox.length = 0;
  jest.clearAllMocks();
});

describe('drainWatchInbox', () => {
  it('commits a valid workout, marks its routine, acks it and reports the saved id', async () => {
    mockInbox.push(entry());
    commitWorkout.mockResolvedValueOnce({ activity: { id: `watch-${UUID}` }, personalRecords: [] });
    await expect(drainWatchInbox()).resolves.toEqual([`watch-${UUID}`]);
    expect(commitWorkout).toHaveBeenCalledWith(expect.objectContaining({ id: `watch-${UUID}` }), {
      markPerformed: true,
    });
    expect(bridge.ackInbox).toHaveBeenCalledWith(UUID);
    expect(mockInbox).toHaveLength(0);
  });

  it('acks a duplicate delivery without reporting it as newly saved', async () => {
    mockInbox.push(entry());
    commitWorkout.mockResolvedValueOnce(null);
    await expect(drainWatchInbox()).resolves.toEqual([]);
    expect(bridge.ackInbox).toHaveBeenCalledWith(UUID);
  });

  it('leaves a workout whose save failed in the inbox for the next launch', async () => {
    mockInbox.push(entry());
    commitWorkout.mockRejectedValueOnce(new Error('disk full'));
    await expect(drainWatchInbox()).resolves.toEqual([]);
    expect(bridge.ackInbox).not.toHaveBeenCalled();
    expect(bridge.rejectInbox).not.toHaveBeenCalled();
    expect(mockInbox).toHaveLength(1);
  });

  it('keeps a newer-version workout for an app update and tells the user once', async () => {
    mockInbox.push(entry(document(), { version: 2 }));
    await drainWatchInbox();
    await drainWatchInbox();
    expect(mockInbox).toHaveLength(1);
    expect(bridge.rejectInbox).not.toHaveBeenCalled();
    expect(reportWatchInboxProblem).toHaveBeenCalledTimes(1);
    expect(reportWatchInboxProblem).toHaveBeenCalledWith('version');
  });

  it('sets an unreadable workout aside and tells the user', async () => {
    mockInbox.push(entry('not json', { id: 'bad' }), entry(document({ entries: [{}] }), { id: 'bounds' }));
    await drainWatchInbox();
    expect(bridge.rejectInbox.mock.calls.map(([id]: [string]) => id)).toEqual(['bad', 'bounds']);
    expect(reportWatchInboxProblem).toHaveBeenCalledWith('invalid');
    expect(commitWorkout).not.toHaveBeenCalled();
  });

  it('runs one drain at a time and reads the inbox again when asked mid-drain', async () => {
    let second: Promise<string[]> | null = null;
    bridge.listInbox.mockImplementationOnce(async () => {
      // An inbox event arriving while this drain is reading.
      second = drainWatchInbox();
      return [];
    });
    const first = drainWatchInbox();
    await first;
    expect(second).toBe(first);
    expect(bridge.listInbox).toHaveBeenCalledTimes(2);
  });

  it('never throws when the native side fails', async () => {
    bridge.listInbox.mockRejectedValueOnce(new Error('disk'));
    await expect(drainWatchInbox()).resolves.toEqual([]);
  });
});
