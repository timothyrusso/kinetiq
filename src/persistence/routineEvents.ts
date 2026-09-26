/**
 * "The routines on disk changed", for code that mirrors them elsewhere.
 *
 * The watch keeps a copy of every routine (issue #27), pushed after each write. The repository
 * announces its writes here rather than calling the watch sync itself, so persistence knows
 * nothing about the watch and a listener that throws cannot fail a save.
 */
const listeners = new Set<() => void>();

export function onRoutinesChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyRoutinesChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[routines] change listener failed', error);
    }
  }
}
