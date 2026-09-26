/** Small functional helpers shared across selectors and components. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return [...arr];
  }
  const out = [...arr];
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved as T);
  return out;
}

let counter = 0;

/**
 * Collision-safe id for local rows. Ordered by construction, so lists sorted by
 * id keep insertion order: unlike random UUIDs.
 */
export function localId(prefix = 'id'): string {
  counter = (counter + 1) % 0xffff;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
}
