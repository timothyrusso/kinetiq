import type { WatchInboxEntry } from '../../../modules/watch-bridge';
import { drainWatchInbox } from '../inbox';

jest.mock('../../../modules/watch-bridge', () => {
  const entries: WatchInboxEntry[] = [];
  const remove = async (id: string) => {
    entries.splice(entries.findIndex((e) => e.id === id), 1);
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

const { mockInbox, watchBridge: mockBridge } = jest.requireMock('../../../modules/watch-bridge') as {
  mockInbox: WatchInboxEntry[];
  watchBridge: {
    listInbox: jest.Mock;
    ackInbox: jest.Mock;
    rejectInbox: jest.Mock;
  };
};


beforeEach(() => {
  mockInbox.length = 0;
  jest.clearAllMocks();
});

describe('drainWatchInbox', () => {
  it('moves an unknown format or version aside instead of retrying it forever', async () => {
    mockInbox.push(
      { id: 'a', format: 'kinetiq.watch-workout', version: 2, payload: '{}' },
      { id: 'b', format: 'something-else', version: 1, payload: '{}' },
      { id: 'c', format: '', version: 0, payload: '' },
    );
    await drainWatchInbox();
    expect(mockBridge.rejectInbox.mock.calls.map(([id]: [string]) => id)).toEqual(['a', 'b', 'c']);
    expect(mockBridge.ackInbox).not.toHaveBeenCalled();
  });

  it('runs one drain at a time and reads the inbox again when asked mid-drain', async () => {
    const first = drainWatchInbox();
    const second = drainWatchInbox();
    expect(second).toBe(first);
    await first;
    expect(mockBridge.listInbox).toHaveBeenCalledTimes(2);
  });

  it('never throws when the native side fails', async () => {
    mockBridge.listInbox.mockRejectedValueOnce(new Error('disk'));
    await expect(drainWatchInbox()).resolves.toEqual([]);
  });
});
