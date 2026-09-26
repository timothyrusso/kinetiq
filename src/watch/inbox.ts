/**
 * Saves the finished watch workouts waiting in the native inbox (issue #27).
 *
 * Serialised behind one module-level promise, so the launch and a return to the foreground
 * (or an inbox event arriving while a drain runs) cannot process the same file twice at once.
 * An entry leaves the inbox only when it is committed or already saved (`ackInbox`), or can
 * never be read (`rejectInbox`, which keeps the file). A save that fails, or a document from a
 * newer watch app, stays for the next drain: nothing is ever dropped.
 */
import { watchBridge, type WatchInboxEntry } from '../../modules/watch-bridge';
import { openDatabase } from '@/persistence';
import { commitWorkout } from '@/workout/commitWorkout';
import { reportWatchInboxProblem } from './inboxNotice';
import { parseWatchWorkout } from './parseWorkout';

let running: Promise<string[]> | null = null;
let again = false;
/** Newer-version entries already reported this launch, so each is told once, not every drain. */
const reported = new Set<string>();

/** Returns the activity ids it saved, so the caller can refresh what shows them. */
export function drainWatchInbox(): Promise<string[]> {
  if (running) {
    // A drain is in flight: run once more after it, so an entry that landed mid-drain is seen.
    again = true;
    return running;
  }
  running = (async () => {
    const saved: string[] = [];
    try {
      await openDatabase();
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

/** One entry. Returns the activity id when this drain saved it. */
async function processEntry(entry: WatchInboxEntry): Promise<string | null> {
  const parsed = parseWatchWorkout(entry);
  if (!parsed.ok) {
    if (parsed.reason === 'version') {
      if (!reported.has(entry.id)) {
        reported.add(entry.id);
        reportWatchInboxProblem('version');
      }
      return null;
    }
    await watchBridge.rejectInbox(entry.id);
    reportWatchInboxProblem('invalid');
    return null;
  }
  try {
    const result = await commitWorkout(parsed.workout, { markPerformed: true });
    // Saved now, or saved by an earlier delivery of the same workout: either way it is done.
    await watchBridge.ackInbox(entry.id);
    return result === null ? null : result.activity.id;
  } catch (error) {
    console.warn('[watch] could not save a workout from the watch; kept for the next launch', error);
    return null;
  }
}
