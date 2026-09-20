/**
 * Progress group.
 *
 * Only `index` exists today, and the group exists because `routes.progress()` needs a
 * legal URL to point at and a flat `app/progress.tsx` cannot grow the two screens this
 * area plausibly wants next (a per-exercise volume browser, a body-measure log) without
 * moving every importer at once. A card stack, same reasoning as the activity group:
 * anything pushed from here is something the user reads and returns from, and the back
 * gesture is how they return.
 */
import { Stack } from 'expo-router';

export default function ProgressLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
