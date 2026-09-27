import { routineIdOf } from '@/features/routines/domain/utils/routineId';

describe('routineIdOf', () => {
  it('reads a route parameter as a routine id', () => {
    expect(routineIdOf('rtn_push')).toBe('rtn_push');
  });

  it('reads a missing, empty or repeated parameter as null', () => {
    expect([routineIdOf(undefined), routineIdOf(''), routineIdOf(['rtn_a', 'rtn_b'])]).toEqual([null, null, null]);
  });
});
