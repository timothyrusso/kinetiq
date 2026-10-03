import { focusManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { HttpError, SqlError } from '@/features/core/error';
import { getQueryClient, installQueryAdapters } from '@/features/core/query';

const retry = (failureCount: number, error: Error) => {
  const option = getQueryClient().getDefaultOptions().queries?.retry;
  return typeof option === 'function' ? option(failureCount, error) : option;
};

const retryDelay = (attemptIndex: number, error: Error) => {
  const option = getQueryClient().getDefaultOptions().queries?.retryDelay;
  return typeof option === 'function' ? option(attemptIndex, error) : option;
};

/** Fires the app-state listener the adapter registered last, through React Native's jest mock. */
const appStateChanged = (status: AppStateStatus) => jest.mocked(AppState.addEventListener).mock.lastCall?.[1](status);

describe('getQueryClient', () => {
  it('hands out one client for the whole app', () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });

  it('runs the first attempt of every query without waiting for the network', () => {
    expect(getQueryClient().getDefaultOptions().queries?.networkMode).toBe('offlineFirst');
  });

  it('never retries a mutation', () => {
    expect(getQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});

describe('the query retry policy', () => {
  it('retries a server error on its budget', () => {
    const error = new HttpError({ kind: 'server', status: 503, retryAfterSeconds: null });

    expect([retry(0, error), retry(1, error), retry(2, error)]).toEqual([true, true, false]);
  });

  it('never retries a missing resource', () => {
    expect(retry(0, new HttpError({ kind: 'not-found', status: 404, retryAfterSeconds: null }))).toBe(false);
  });

  it('never retries an app error that already ran through its Effect', () => {
    expect(retry(0, new SqlError({ message: 'read the routines' }))).toBe(false);
  });

  it('retries an unknown failure of a plain query once', () => {
    expect([retry(0, new Error('boom')), retry(1, new Error('boom'))]).toEqual([true, false]);
  });

  it('waits the Retry-After the server sent', () => {
    expect(retryDelay(0, new HttpError({ kind: 'rate-limit', status: 429, retryAfterSeconds: 5 }))).toBe(5_000);
  });

  it('backs off exponentially without a Retry-After', () => {
    expect([retryDelay(0, new Error('boom')), retryDelay(2, new Error('boom'))]).toEqual([300, 1_200]);
  });
});

describe('installQueryAdapters', () => {
  it('restores the library default when disposed', () => {
    const dispose = installQueryAdapters();
    focusManager.setFocused(false);

    dispose();

    expect(focusManager.isFocused()).toBe(true);
  });
});

describe('a query that refetches on focus', () => {
  it('refetches when the app comes back to the foreground', async () => {
    const dispose = installQueryAdapters();
    const queryFn = jest.fn(async () => 'granted');
    const client = new QueryClient();
    client.mount();
    const observer = new QueryObserver(client, {
      queryKey: ['permission'],
      queryFn,
      refetchOnWindowFocus: 'always',
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    appStateChanged('background');
    appStateChanged('active');

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    unsubscribe();
    client.unmount();
    client.clear();
    dispose();
  });
});
