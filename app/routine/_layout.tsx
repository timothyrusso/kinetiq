/**
 * Routine group: the builder and the routine itself.
 *
 * `new` is a `modal` because it has no history underneath it. It is reached from the
 * Workout tab's plus button, from Home's empty state and from the not-found screen, and
 * after saving it `replace`s itself with the routine it created. Left in the stack, "back"
 * would return to a form whose only purpose was to be submitted. It also gets the standard
 * modal keyboard treatment on both platforms, which a builder that leads with a name field
 * cannot do without.
 *
 * `[id]` is a plain card for the opposite reason: it is something the user returns from,
 * repeatedly, and the back gesture is how they return. A modal presentation there would
 * break the swipe that the whole browse → open → train → back loop depends on.
 */
import { Stack } from 'expo-router';

export default function RoutineLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
