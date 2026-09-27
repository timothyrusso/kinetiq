import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Clock, Effect } from 'effect';
import { HttpError, UnexpectedError } from '@/features/core/error';
import { useEffectMutation, useEffectQuery } from '@/features/core/query';
import { FeaturesLive } from '@/features/core/runtime/runtime';
import { SqliteClient } from '@/features/core/sqlite';
import { makeTestRuntime, makeTestWrapper } from '@/features/core/testing';

describe('useEffectQuery', () => {
  it('resolves with the value of the Effect it runs on the app runtime', async () => {
    const { runtime, logs } = makeTestRuntime(FeaturesLive);
    const { result } = await renderHook(() => useEffectQuery({ queryKey: ['success'], queryFn: Effect.succeed(42) }), {
      wrapper: makeTestWrapper(runtime),
    });

    await waitFor(() => expect(result.current.data).toBe(42));
    expect(logs.entries).toEqual([]);
    await runtime.dispose();
  });

  it('reports a tagged failure as itself and logs it once as a warning', async () => {
    const { runtime, logs } = makeTestRuntime(FeaturesLive);
    const failure = new HttpError({ kind: 'server', status: 503, retryAfterSeconds: null });
    const { result } = await renderHook(() => useEffectQuery({ queryKey: ['tagged'], queryFn: Effect.fail(failure) }), {
      wrapper: makeTestWrapper(runtime),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(failure);
    expect(result.current.error?._tag).toBe('HttpError');
    expect(logs.entries.map(entry => [entry.level, entry.message])).toEqual([['warn', 'HttpError']]);
    await runtime.dispose();
  });

  it('turns a defect into an UnexpectedError carrying it, logged once as an error', async () => {
    const { runtime, logs } = makeTestRuntime(FeaturesLive);
    const defect = new Error('boom');
    const { result } = await renderHook(() => useEffectQuery({ queryKey: ['defect'], queryFn: Effect.die(defect) }), {
      wrapper: makeTestWrapper(runtime),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(UnexpectedError);
    expect(result.current.error?.cause).toBe(defect);
    expect(logs.entries.map(entry => entry.level)).toEqual(['error']);
    await runtime.dispose();
  });

  it('runs against the core test services: the migrated database and the test clock', async () => {
    const { runtime } = makeTestRuntime(FeaturesLive);
    const { result } = await renderHook(
      () =>
        useEffectQuery({
          queryKey: ['services'],
          queryFn: Effect.gen(function* () {
            const db = yield* SqliteClient;
            const row = yield* Effect.promise(() => db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'));
            return { version: row?.user_version, now: yield* Clock.currentTimeMillis };
          }),
        }),
      { wrapper: makeTestWrapper(runtime) },
    );

    await waitFor(() => expect(result.current.data).toEqual({ version: 10, now: 0 }));
    await runtime.dispose();
  });
});

describe('useEffectMutation', () => {
  it('resolves with the value and reports a tagged failure as itself', async () => {
    const { runtime } = makeTestRuntime(FeaturesLive);
    const failure = new HttpError({ kind: 'bad-request', status: 400, retryAfterSeconds: null });
    const { result } = await renderHook(
      () =>
        useEffectMutation({ mutationFn: (fail: boolean) => (fail ? Effect.fail(failure) : Effect.succeed('saved')) }),
      { wrapper: makeTestWrapper(runtime) },
    );

    await act(async () => {
      expect(await result.current.mutateAsync(false)).toBe('saved');
    });
    await act(async () => result.current.mutate(true));

    await waitFor(() => expect(result.current.error).toBe(failure));
    await runtime.dispose();
  });
});
