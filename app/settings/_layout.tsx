/**
 * Settings group.
 *
 * A card stack, like every other pushed group: each screen here is read-and-return, and
 * the back gesture is how the user returns. `index` is the hub; the three leaves are the
 * sections too large to sit inline on it.
 *
 * There is deliberately no `units` or `appearance` screen in here, even though the route
 * builders once existed. Both are one-control settings, and the Profile tab's own header
 * explains why they live *there* rather than behind a hub: changing units is something you
 * do while looking at a number that is currently in the wrong ones. A second copy of that
 * control down a nav stack would be a second place for the two to disagree.
 */
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
