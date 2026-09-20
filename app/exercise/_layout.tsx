/**
 * Exercise group: a detail screen and the sheet that saves an exercise into a routine.
 *
 * The detail is a `card` because it is something the user reads and returns from, and
 * because it is the *only* way into an exercise's own screens: the Exercises tab, the
 * Workout tab's library preview, a routine's item row and the "variations" row all push
 * the same route. `Modal` presentations break the back gesture that reading depends on.
 *
 * The add-to-routine sheet is a genuine `modal`, for the opposite reason: it has no
 * history of its own under it. Coming back from it should land on the exercise the user
 * was reading, not walk them out of it.
 */
import { Stack } from 'expo-router';

export default function ExerciseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
