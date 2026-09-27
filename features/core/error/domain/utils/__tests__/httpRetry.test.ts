import { httpRetryDelayMs } from '@/features/core/error/domain/utils/httpRetry';

describe('httpRetryDelayMs', () => {
  it('waits the Retry-After the server sent', () => {
    expect(httpRetryDelayMs(0, 5)).toBe(5_000);
  });

  it('waits at least a second for a Retry-After of zero', () => {
    expect(httpRetryDelayMs(0, 0)).toBe(1_000);
  });

  it('caps a Retry-After of an hour at one minute', () => {
    expect(httpRetryDelayMs(0, 3_600)).toBe(60_000);
  });

  it('backs off exponentially without a Retry-After', () => {
    expect([0, 1, 2].map(attempt => httpRetryDelayMs(attempt, null))).toEqual([300, 600, 1_200]);
  });

  it('caps the backoff at 20 seconds', () => {
    expect(httpRetryDelayMs(10, null)).toBe(20_000);
  });
});
