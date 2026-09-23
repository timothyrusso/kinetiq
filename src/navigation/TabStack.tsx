/**
 * The stack every tab renders: native header, large title, the app's colours.
 *
 * One component for all five so the tabs cannot drift apart in header behaviour. Each tab's
 * screen sets only its own title, through `Stack.Screen`.
 */
import { Stack } from 'expo-router';

import { useLargeTitleOptions } from './headerOptions';

export function TabStack() {
  const screenOptions = useLargeTitleOptions();
  return <Stack screenOptions={screenOptions} />;
}
