import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

const key = (name: string): string => name.trim().toLocaleLowerCase();

/** Whether two routine names are the same name: case and the spaces around them do not count. */
export function sameRoutineName(a: string, b: string): boolean {
  return key(a) === key(b);
}

/**
 * `base`, or the first of `base 2`, `base 3` and on that no name in `taken` already is: a copy or
 * an unnamed routine gets a name of its own instead of a second routine called the same.
 */
export function freeRoutineName(base: string, taken: readonly string[]): string {
  const used = new Set(taken.map(key));
  if (!used.has(key(base))) return base.trim();
  let n = 2;
  while (used.has(key(`${base} ${n}`))) n += 1;
  return `${base.trim()} ${n}`;
}

/**
 * The name of a routine the user did not name: its first exercise, and how many more follow. A
 * routine of squats called nothing is called Squats.
 */
export function derivedRoutineName(items: readonly RoutineItem[]): string {
  const first = items[0]?.exerciseName ?? 'New routine';
  return items.length > 1 ? `${first} + ${items.length - 1} more` : first;
}
