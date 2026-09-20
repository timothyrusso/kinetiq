/**
 * Activity history group.
 *
 * A plain `card` stack. An activity is something the user reads and returns from, and
 * `Modal`-family presentations break the back gesture that reading depends on: a sheet you
 * can only dismiss by dragging it down has no gesture left for "go back to the list where I
 * was". The detail screen scrolls under its own header, so nothing here needs `headerShown`.
 */
import { Stack } from 'expo-router';

export default function ActivityLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
