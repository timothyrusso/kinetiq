/**
 * English copy. This file is the source of truth for both the wording and the key set.
 *
 * ## Keys are paths, not sentences
 *
 * `tabs.home`, not `HOME` or the English string itself. A key that IS the English string means
 * every copy edit is a key rename across every locale, and a key like `SAVE` cannot distinguish
 * the "Save" that commits a form from the "Save" that means "keep this for later", which are
 * different words in Italian.
 *
 * ## Interpolation
 *
 * `{name}` placeholders, substituted by `t()`. No expression evaluation: a translation file is
 * data, and a template that can run code is a template that can throw inside a render.
 *
 * ## Plurals
 *
 * A key ending `_one` / `_other` is chosen by `t()` from a `count`. English and Italian agree
 * on which forms exist, which is why two suffixes suffice here and why the plural logic lives
 * in one place rather than at every call site.
 */
export const en = {
  tabs: {
    home: 'Home',
    activities: 'Activities',
    workout: 'Workout',
    exercises: 'Exercises',
    profile: 'Profile',
  },

  common: {
    save: 'Save',
    cancel: 'Cancel',
    done: 'Done',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    close: 'Close',
    retry: 'Try again',
    search: 'Search',
    filters: 'Filters',
    clear: 'Clear',
    back: 'Go back',
    loading: 'Loading',
    noValue: '-',
    system: 'System',
  },

  home: {
    eyebrowMorning: 'Good morning',
    eyebrowAfternoon: 'Good afternoon',
    eyebrowEvening: 'Good evening',
    thisWeek: 'This week',
    sessions: 'Sessions',
    distance: 'Distance',
    volume: 'Volume',
    calories: 'Calories',
    trainingLoad: 'Training load',
    lastSixWeeks: 'Last 6 weeks',
    latestSessions: 'Latest sessions',
    streak_one: '{count} day',
    streak_other: '{count} days',
    goalRemaining: '{count} to weekly goal',
    goalMet: 'Weekly goal met',
    goalLeft_one: '{count} session left to hit your weekly goal.',
    goalLeft_other: '{count} sessions left to hit your weekly goal.',
    emptyTitle: 'No training yet',
    emptyMessage:
      'Pick a routine and go lift something. Kinetiq keeps score from the first set you finish.',
  },

  activities: {
    title: 'Activities',
    eyebrow: 'History',
    searchPlaceholder: 'Session name, notes, exercise',
    sortRecent: 'Recent',
    sortLongest: 'Longest',
    sortFurthest: 'Furthest',
    sortHeaviest: 'Heaviest',
    kindRuns: 'Runs',
    kindRides: 'Rides',
    kindStrength: 'Strength',
    kindWalks: 'Walks',
    kindYoga: 'Yoga',
    today: 'Today',
    yesterday: 'Yesterday',
    session_one: '{count} session',
    session_other: '{count} sessions',
    emptyTitle: 'Nothing matches',
    emptyMessage: 'Try a different filter, or clear the search.',
  },

  workout: {
    title: 'Workout',
    eyebrow: 'Train',
    yourRoutines: 'Your routines',
    newRoutine: 'New routine',
    routinesReady_one: '{count} routine ready to train',
    routinesReady_other: '{count} routines ready to train',
    recordActivity: 'Record an activity',
    recordSubtitle: 'Run, ride or walk',
    startWorkout: 'Start this workout',
    routineOptions: 'Routine options',
    rename: 'Rename',
    duplicate: 'Duplicate',
    deleteRoutine: 'Delete routine',
    inProgress: '{name} is already in progress. Finish or discard it before starting another.',
    paused: 'Paused',
    resume: 'Resume',
    discard: 'Discard',
    finish: 'Finish and save',
    restTimer: 'Rest timer',
    exercise_one: '{count} exercise',
    exercise_other: '{count} exercises',
    set_one: '{count} set',
    set_other: '{count} sets',
  },

  exercises: {
    title: 'Exercises',
    eyebrow: 'Library',
    searchLabel: 'Search exercises',
    searchPlaceholder: 'Deadlift, lat pulldown, lunges',
    searchHint: 'Search the exercise catalog',
    count_one: '{count} exercise',
    count_other: '{count} exercises',
    countFor_one: '{count} exercise for "{query}"',
    countFor_other: '{count} exercises for "{query}"',
    addExercises: 'Add exercises',
    addExercise: 'Add exercise',
    fromLibrary: 'Searched live from the exercise library',
    noneMatch: 'No exercises match',
    unavailable: 'Exercise search unavailable',
    outdated: 'Outdated results',
    outdatedDetail: 'That search failed. Showing the results from before it.',
    updating: 'Updating',
    updatingDetail: 'Showing the previous search while this one runs',
    loadMore: 'Load more',
    allLoaded_one: 'All {count} exercise loaded',
    allLoaded_other: 'All {count} exercises loaded',
  },

  profile: {
    title: 'Athlete',
    eyebrow: 'Profile',
    preferences: 'Preferences',
    units: 'Units',
    appearance: 'Appearance',
    language: 'Language',
    weeklyGoal: 'Weekly goal',
    storedOnDevice: 'Routines and history are stored on this device',
    ageYears: '{count} years old',
  },

  settings: {
    title: 'Settings',
    you: 'You',
    usedForEstimates: 'Used for estimates',
    name: 'Name',
    height: 'Height',
    birthYear: 'Birth year',
    app: 'App',
    trainingPreferences: 'Training preferences',
    trainingSubtitle: 'Default rest, auto-start, speed against pace',
    notifications: 'Notifications',
    permissions: 'Permissions',
    permissionsSubtitle: 'Location, notifications, motion',
    metric: 'Metric',
    imperial: 'Imperial',
    light: 'Light',
    dark: 'Dark',
    english: 'English',
    italian: 'Italiano',
    languageHint: 'Changes everything in the app straight away.',
  },

  errors: {
    offlineTitle: 'No connection',
    offlineMessage: 'Your routines and history are here. Fresh exercises need a network.',
    genericTitle: 'Something went wrong',
    saveFailed: 'Could not save. Nothing was lost, the routine is still here as you left it.',
    permissionDenied: 'Permission denied',
  },
} as const;

/**
 * The catalog's SHAPE, with values widened to `string`.
 *
 * `as const` above freezes each value to its own literal type, which is what makes the key
 * union exact. Without this widening, `it: Copy` would demand the English words themselves:
 * TypeScript would reject "Attività" for not being "Activities". Keys stay exact, values become
 * `string`, so a missing or misspelled KEY in a translation is still a compile error.
 */
export type Copy = {
  [S in keyof typeof en]: { [K in keyof (typeof en)[S]]: string };
};
