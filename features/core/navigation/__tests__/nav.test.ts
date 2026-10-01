import { routes, TAB_LABELS, TAB_ROUTES, tabHref } from '@/features/core/navigation';

describe('tabHref', () => {
  it('links each tab in bar order', () => {
    expect(TAB_ROUTES.map((_, index) => tabHref(index))).toEqual(['/(tabs)', '/workout', '/profile']);
  });

  it('falls back to Home for an index past the last tab', () => {
    expect(tabHref(9)).toBe('/(tabs)');
  });
});

describe('TAB_LABELS', () => {
  it('names every tab by a catalog key', () => {
    expect(TAB_ROUTES.map(key => TAB_LABELS[key])).toEqual(['tabs.home', 'tabs.workout', 'tabs.profile']);
  });
});

describe('routes', () => {
  it('passes a detail id as a param rather than in the path', () => {
    expect(routes.exerciseDetail('ex:barbell-bench-press')).toEqual({
      pathname: '/exercise/[id]',
      params: { id: 'ex:barbell-bench-press' },
    });
  });

  it('sends the Workout and Home destinations to their tabs', () => {
    expect([routes.workoutTab(), routes.home()]).toEqual(['/workout', '/(tabs)']);
  });

  it('names the routine a picker adds to only when there is one', () => {
    expect([routes.pickExercise('draft'), routes.pickExercise('routine', 'rtn_1')]).toEqual([
      { pathname: '/pick-exercise', params: { target: 'draft' } },
      { pathname: '/pick-exercise', params: { target: 'routine', id: 'rtn_1' } },
    ]);
  });

  it('names the routine an item editor writes to only when there is one', () => {
    expect([routes.routineItem('draft', 'rit_1'), routes.routineItem('routine', 'rit_1', 'rtn_1')]).toEqual([
      { pathname: '/routine/item', params: { target: 'draft', item: 'rit_1' } },
      { pathname: '/routine/item', params: { target: 'routine', item: 'rit_1', id: 'rtn_1' } },
    ]);
  });

  it('passes the set position as strings', () => {
    expect(routes.sessionSet(1, 2)).toEqual({ pathname: '/workout/set', params: { entry: '1', set: '2' } });
  });

  it('passes the records a finish set as JSON', () => {
    expect(routes.sessionRecords([{ kind: 'volume' }])).toEqual({
      pathname: '/workout/records',
      params: { records: '[{"kind":"volume"}]' },
    });
  });
});
