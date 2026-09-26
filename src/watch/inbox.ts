/**
 * Drains the native inbox of finished watch workouts (issue #27).
 *
 * Serialised behind one module-level promise, so the launch and a return to the foreground
 * (or an inbox event arriving while a drain runs) cannot process the same file twice at once.
 * An entry leaves the inbox only when it is committed (`ackInbox`) or can never be read
 * (`rejectInbox`, which keeps the file); anything else stays for the next drain.
 */
import { watchBridge, type WatchInboxEntry } from '../../modules/watch-bridge';
import { WATCH_FORMAT_VERSION, WATCH_WORKOUT_FORMAT } from './format';

let running: Promise<string[]> | null = null;
let again = false;

/** Returns the ids of the workouts it saved, so the caller can refresh what shows them. */
export function drainWatchInbox(): Promise<string[]> {
  if (running) {
    // A drain is in flight: run once more after it, so an entry that landed mid-drain is seen.
    again = true;
    return running;
  }
  running = (async () => {
    const saved: string[] = [];
    try {
      do {
        again = false;
        const entries = await watchBridge.listInbox();
        for (const entry of entries) {
          const id = await processEntry(entry);
          if (id !== null) saved.push(id);
        }
      } while (again);
    } catch (error) {
      console.warn('[watch] could not drain the inbox', error);
    } finally {
      running = null;
    }
    return saved;
  })();
  return running;
}

/**
 * One entry. An unknown format or version can never become readable, so it is moved aside;
 * a known one waits in the inbox until the phone can commit it.
 */
async function processEntry(entry: WatchInboxEntry): Promise<string | null> {
  if (entry.format !== WATCH_WORKOUT_FORMAT || entry.version !== WATCH_FORMAT_VERSION) {
    await watchBridge.rejectInbox(entry.id);
    return null;
  }
  return null;
}
