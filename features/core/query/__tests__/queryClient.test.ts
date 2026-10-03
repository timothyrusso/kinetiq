import { focusManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { SqlError } from '@/features/core/error';
import { getQueryClient, installQueryAdapters } from '@/features/core/query';

const retry = (failureCount: number, error: Error) => {
  const option = getQueryClient().getDefaultOptions().queries?.retry;
  return typeof option === 'function' ? option(failureCount, error) : option;
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
  it('never retries an app error that already ran through its Effect', () => {
    expect(retry(0, new SqlError({ message: 'read the routines' }))).toBe(false);
  });

  it('retries an unknown failure of a plain query once', () => {
    expect([retry(0, new Error('boom')), retry(1, new Error('boom'))]).toEqual([true, false]);
  });

  it('waits briefly before that retry', () => {
    expect(getQueryClient().getDefaultOptions().queries?.retryDelay).toBe(300);
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
