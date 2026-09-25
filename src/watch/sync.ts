/**
 * Keeps the watch's copy of the routines current (issue #27).
 *
 * The phone pushes a snapshot after every routine write (debounced, so an import of fifty
 * routines sends one), when the unit setting changes, on every return to the foreground, and
 * when the watch's Sync button asks. The native side drops a push whose content the watch
 * already has, so pushing often costs nothing.
 *
 * Nothing here can fail a routine save or the launch: every step catches in place, because the
 * watch is a mirror and the phone's own data is the thing that matters.
 */
import { watchBridge } from '../../modules/watch-bridge';
import { onRoutinesChanged, routineRepository } from '@/persistence';
import { getSettings, subscribeSettings } from '@/settings/store';
import { buildWatchRoutines } from './snapshot';

const PUSH_DEBOUNCE_MS = 500;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

/**
 * A 53-bit hash (cyrb53) of the snapshot without its timestamp. Only has to tell "same routines"
 * from "changed routines"; a collision would delay one update until the next change or Sync.
 */
function contentKey(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Builds the snapshot from the database and hands it to the native side. */
export async function pushRoutineSnapshot(
  options: { force?: boolean; requestId?: string | null } = {},
): Promise<void> {
  if (!watchBridge.isSupported()) return;
  try {
    const routines = await routineRepository.list();
    const now = new Date();
    const document = buildWatchRoutines(routines, getSettings().unitSystem, now);
    const { exportedAt: _exportedAt, ...content } = document;
    watchBridge.pushSnapshot(
      `snap-${now.getTime().toString(36)}`,
      JSON.stringify(document),
      contentKey(JSON.stringify(content)),
      options.force ?? false,
      options.requestId ?? null,
    );
  } catch (error) {
    console.warn('[watch] could not push the routine snapshot', error);
  }
}

function schedulePush(): void {
  if (pushTimer !== null) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushRoutineSnapshot();
  }, PUSH_DEBOUNCE_MS);
}

/**
 * Subscribes the snapshot to its triggers. Called once, after the database is open; the
 * disposer exists for symmetry with the other lifecycle installers.
 */
export function installWatchSync(onInboxChanged: () => void): () => void {
  // A bootstrap retried after a failure must not subscribe a second time.
  if (installed || !watchBridge.isSupported()) return () => {};
  installed = true;
  let unitSystem = getSettings().unitSystem;
  const snapshotRequests = watchBridge.addSnapshotRequestListener((requestId) => {
    void pushRoutineSnapshot({ force: true, requestId });
  });
  const inbox = watchBridge.addInboxListener(onInboxChanged);
  const disposers = [
    onRoutinesChanged(schedulePush),
    subscribeSettings(() => {
      const next = getSettings().unitSystem;
      if (next === unitSystem) return;
      unitSystem = next;
      schedulePush();
    }),
    () => snapshotRequests.remove(),
    () => inbox.remove(),
  ];
  return () => {
    for (const dispose of disposers) dispose();
    installed = false;
  };
}
