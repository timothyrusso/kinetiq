/**
 * The workout flow: the live session, the cardio recorder, and the log of finished
 * strength sessions.
 *
 * There is no route for adding an exercise to a running workout. It is a sheet the session
 * screen owns (`ExercisePickerSheet`), because the thing being chosen has to arrive back as a
 * value: and a pushed route hands values back through the URL or through a store, which on
 * the one screen in the app that must not lose state is the wrong trade.
 *
 * ## Why `app/workout/` and not `app/(workout)/workout/`
 *
 * `nav.ts` fixes these URLs as `/workout/session`, `/workout/cardio` and
 * `/workout/history`, because `tabKeyForPathname` reads the first segment to decide
 * both which tab to keep lit and when to hide the bar behind the player. A group folder
 * could reproduce those paths (`app/(workout)/workout/session.tsx`), but not the thing
 * that actually matters: a *directory* at `app/workout/` and the tab at
 * `app/(tabs)/workout.tsx` claim the same URL, and expo-router resolves a route group
 * first, which would shadow the tab. The group would then have to own `/workout` itself,
 * i.e. re-host the tab, and the whole `TAB_ROUTES` model falls apart. Un-grouped files
 * under a path the tab also contributes is how Expo ships tabs plus detail routes, and it
 * is what `app/_layout.tsx` already expects: it declares `<Stack.Screen name="workout" />`
 * on the assumption that the path exists as a top-level subtree.
 *
 * ## Card, not sheet
 *
 * Inherited from the root layout's `workout` screen (see the note there): these screens still
 * navigate onward: on finish, the session replaces itself with the log of completed workouts
 * rather than popping back into a routine tab that no longer knows what just happened: and a
 * `modal` presentation cannot navigate. The bottom-sheet *feel*: rounded top corners,
 * slide-from-below: comes from the transition, which does not need `presentation` to look
 * like one.
 *
 * ## No `contentStyle` here
 *
 * The root sets it transparent for every route so the canvas colour has one owner
 * (`GestureRoot`). Every screen in this group paints its own background at the route level
 * anyway, because the player scrolls edge to edge under its own bar.
 */
import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/*
        The player. `gestureEnabled: false` on iOS, deliberately.

        The interactive back gesture would let a swipe discard an unfinished workout: and
        the one moment someone swipes back is the moment they reach for their phone between
        sets. There is no confirmation to intercept it with either: `expo-router` cannot
        veto a native pop, so the only options are "lose the workout" or "no gesture".
        Everything that leaves this screen is an explicit button, and the two that destroy
        data (`Discard`, `Finish`) are confirmed. Back-gesture reliability is exactly what
        this app asks its sheets for, which makes it the wrong thing to hand a workout.
      */}
      <Stack.Screen
        name="session"
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      {/*
        The recorder. Same reasoning as the player, and it applies *after* Start is pressed:
        once a session is live, the only exits on screen are Stop and Discard, because a swipe
        that appears to cancel six kilometres is the failure this route exists to prevent.
        (Nothing is genuinely lost by leaving: the recorder is a module singleton and keeps
        running: but a gesture that looks destructive has to go, even when it is not.)
      */}
      <Stack.Screen
        name="cardio"
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen name="history" />
    </Stack>
  );
}
