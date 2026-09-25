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
    workout: 'Workout',
    profile: 'Profile',
  },

  common: {
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    add: 'Add',
    retry: 'Try again',
    back: 'Go back',
    system: 'System',
  },

  // --- group-a ---
  tabsProfile: {
    height: '{height} cm',
    age_one: '{count} year old',
    age_other: '{count} years old',
  },
  // --- end group-a ---

  home: {
    startWorkout: 'Start a workout',
    historyError: 'Your workouts could not be loaded',
    emptyTitle: 'No workouts yet',
    emptyMessage:
      'Start a workout from the Workout tab. Every session you finish lands here, newest first.',
  },


  heatmap: {
    title: 'Training days',
    eyebrow: 'Minutes per day · last {count} weeks',
    workouts_one: '{count} workout in {weeks} weeks',
    workouts_other: '{count} workouts in {weeks} weeks',
    a11y: 'Training days: you trained on {days} days in the last {weeks} weeks, {workouts}',
    less: 'Less',
    more: 'More',
  },

  accent: {
    title: 'Accent colour',
    kinetiq: 'Kinetiq lime',
    system: 'Wallpaper colours',
    ocean: 'Ocean blue',
    sunset: 'Sunset orange',
    berry: 'Berry purple',
    ruby: 'Ruby red',
  },

  workout: {
    title: 'Workout',
    yourRoutines: 'Your routines',
    newRoutine: 'New routine',
    paused: 'Paused',
    exercise_one: '{count} exercise',
    exercise_other: '{count} exercises',
    set_one: '{count} set',
    set_other: '{count} sets',
  },

  exercises: {
    addExercise: 'Add exercise',
  },

  profile: {
    preferences: 'Preferences',
    units: 'Units',
    appearance: 'Appearance',
    language: 'Language',
  },

  settings: {
    you: 'You',
    usedForEstimates: 'Used for estimates',
    name: 'Name',
    height: 'Height',
    birthYear: 'Birth year',
    notifications: 'Notifications',
    metric: 'Metric',
    imperial: 'Imperial',
    light: 'Light',
    dark: 'Dark',
    english: 'English',
    italian: 'Italiano',
  },

  // --- group-b ---
  details: {
    repsValue: '{reps} reps',
    bodyweightA11y: 'Bodyweight',
    lastTrained: 'Last trained {ago}',
    pickerInLibrary: '{total} exercises in the library',
    pickerIncluded_one: '{count} is already in this routine',
    pickerIncluded_other: '{count} are already in this routine',
    lastPerformedAgo: 'Last performed {ago}',
    setsOfTotal: '{done} of {total} sets',
  },
  // --- end group-b ---
  activity: {
    openExerciseHint: 'Opens this exercise, with your history and records',
    fallbackTitle: 'Workout',
    delete: 'Delete this workout',
    loadError: 'Could not open this workout',
    notesTitle: 'Session notes',
    notesLabel: 'Notes',
    notesPlaceholder: 'How did it feel? What would you change next time?',
    notesHint: 'Stored on this device alongside the workout.',
    notesSaveFailed: 'The note could not be saved.',
    deleteTitle: 'Delete this session?',
    deleteMessage:
      '"{name}" goes with it. Its numbers come out of your totals and records once it is gone, so the charts will move.',
    deleteConfirm: 'Delete session',
    deleteFailed: 'The session could not be deleted.',
    emptyTitle: 'Nothing was captured',
    emptyMessage:
      'This session has a duration and no metrics. It still counts toward your streak and your totals.',
    session: 'Session',
    summary: 'Summary',
    duration: 'Duration',
    calories: 'Calories',
    noEstimate: 'Estimate unavailable',
    volume: 'Volume',
    repsTimesWeight: 'Reps × weight',
    bodyweightWork: 'Bodyweight work, or nothing completed',
    sets: 'Sets',
    completed: 'completed',
    noSets: 'No sets recorded',
    movements: 'Movements',
    nothingAdded: 'Nothing added',
    density: 'Density',
    volumePerMinute: 'Volume per minute',
    needsMinute: 'Needs a minute of volume',
    exercises: 'Exercises',
    work: 'Work',
    records: 'Records',
    setThisSession: 'Set this session',
    firstOfKind: ': first of its kind',
    upFrom: ': up from {value}',
    colSet: 'SET',
    colKg: 'KG',
    colLb: 'LB',
    colReps: 'REPS',
    colE1rm: 'E-1RM',
    skipped: 'Skipped',
    allDone: 'All done',
    topSet: 'Top {weight} × {reps}',
    bodyweightShort: 'BW',
    bodyweight: 'bodyweight',
    setNumber: 'Set {n}',
    setNotDone: 'Set {n} not completed',
    setWord_one: 'set',
    setWord_other: 'sets',
    repWord_one: 'rep',
    repWord_other: 'reps',
    exerciseWord_one: 'exercise',
    exerciseWord_other: 'exercises',
    notesSection: 'Notes',
    notesEmpty:
      'Nothing written for this session yet. A line about how it felt is the part you will wish you had in three months.',
    editNotes: 'Edit notes',
    addNotes: 'Add notes',
    notesSubtitle: 'How it felt, what to change next time',
    notMeasured: 'Not measured',
  },
  routine: {
    title: 'Routine',
    noExercisesYet: 'This routine has no exercises yet. Add one before starting it.',
    reorderFailed: 'That reorder did not stick. Try it again.',
    removeFailed: 'That exercise is still in the routine. Try removing it again.',
    addFailed: 'That exercise could not be added. Nothing was removed.',
    duplicateFailed: 'Could not duplicate. The routine is untouched.',
    deleteFailed: 'Could not delete it. Nothing was removed.',
    readError: 'This routine could not be read',
    goneTitle: 'This routine is gone',
    goneMessage: 'It was deleted, most likely from another screen in this app.',
    backToWorkouts: 'Back to workouts',
    bodyweight: 'Bodyweight',
    options: 'Routine options',
    start: 'Start this workout',
    plannedVolume: 'Volume',
    estTime: 'Est. time',
    trained: 'Trained',
    emptyTitle: 'No exercises in this routine',
    emptyMessage:
      'Nothing here to train yet. Add one from the library and it is stored on the device straight away.',
    exercises: 'Exercises',
    rowWord_one: 'row',
    rowWord_other: 'rows',
    exerciseWord_one: 'exercise',
    exerciseWord_other: 'exercises',
    timeWord_one: 'time',
    timeWord_other: 'times',
    openWorkout: 'Open your workout',
    openHint: 'Opens the workout that is already running',
    startHint: 'Begins this workout and opens the session',
    rename: 'Rename',
    duplicate: 'Duplicate',
    deleteRoutine: 'Delete routine',
    renameFailed: 'The name did not change. Try again.',
    deleteTitle: 'Delete “{name}”?',
    deleteCompleted:
      'You have completed it {count} {word}. Those workouts stay in your history and your progress: only the plan is removed.',
    deleteNever:
      'This routine has never been completed, and nothing else will reference it once it is gone.',
    nameRequired: 'A routine needs a name.',
    renameTitle: 'Rename routine',
    renameHint: 'Future workouts keep this name in your history',
    nameLabel: 'Name',
    nameFieldHint: 'The name of this routine',
    saveName: 'Save name',
    liveNamed: '“{name}” is already in progress. Finish or discard it before starting another.',
    liveUnnamed: 'A workout is already in progress. Finish or discard it before starting another.',
  },
  exerciseDetail: {
    heaviestWeight: 'Heaviest weight',
    perSession: 'Per session',
    weightChartA11y: 'Heaviest set in each of {count} sessions, from {first} to {last}',
    fallbackTitle: 'Exercise',
    loadError: 'Could not load this exercise',
    unknownTitle: 'Nothing known about this exercise',
    unknownFetchable:
      'It is not in your routines, and the exercise library did not answer. Check your connection and try again.',
    unknownBuiltIn:
      'This exercise came from the built-in library, which does not store a description for it.',
    backToLibrary: 'Back to library',
    howTo: 'How to do it',
    noDescriptionOffline:
      'No description was saved with this exercise, and the library is offline right now.',
    noDescription:
      'The exercise library has no description for this one. Your own notes from past sessions are the best reference.',
    muscles: 'Muscles',
    primary: 'Primary',
    alsoWorked: 'Also worked',
    equipment: 'Equipment',
    yourHistory: 'Your history',
    sessionCount_one: '{count} session',
    sessionCount_other: '{count} sessions',
    neverLogged:
      'You have not logged this exercise yet. Finish a session with it and your numbers will appear here.',
    totalVolume: 'Total volume',
    setsDone: 'Sets done',
    earlierSessions_one: '{count} earlier session in your history.',
    earlierSessions_other: '{count} earlier sessions in your history.',
    records: 'Records',
    personalBests: 'Personal bests',
    variations: 'Variations',
    sameFamily: 'Same movement family',
    thisExercise: 'This exercise',
    variation: 'Variation',
    viewOnWger: 'View on wger',
    wgerSubtitle: 'Community page with all photos and notes',
    noImage: 'No image in the library',
    illustrationFor: 'Illustration for {name}',
    offlineCopy: 'Offline copy saved on this device',
    offlineCopyDated: 'Offline copy saved {date}',
    checking: 'Checking…',
    checkUpdates: 'Check for updates',
    fromRecentSearch: 'From your recent search results',
    liveFromWger: 'Live from the wger community library',
    justNow: ' · just now',
    builtIn: 'Built-in exercise',
    bodyweightTimes: 'Bodyweight × {reps}',
    openSession: 'Opens the session',
    estSuffix: '{value} est',
  },

  records: {
    est1rm: 'Heaviest single estimated',
    volume: 'Most volume',
    maxReps: 'Most reps in one set',
  },

  about: {
    title: 'About',
    version: 'Version',
    unknown: 'unknown',
    appId: 'App ID',
    appIdHint: 'Worth quoting if something breaks.',
    storageNote:
      'Everything is stored on this device. Kinetiq has no account, no sign-in, and no server of its own.',
    catalog: 'Exercise catalog',
    servedRemotely: 'Served remotely',
    catalogNote:
      'The exercise library: search, photos, muscles and equipment: is served by an external catalog, live.',
    localNote:
      'Your own data never depends on it. Every exercise you add to a routine is stored as a local snapshot, so routines and history keep working when the catalog is offline, rate-limited, or gone.',
    needsConnection:
      'Browsing for new exercises needs a connection. Using the ones you saved does not.',
    onThisDevice: 'On this device',
    activities: 'Workouts',
    counting: 'counting…',
    nothingStored: 'Nothing stored yet.',
    routines: 'Routines',
    routinesHint: 'Each carries its own exercise snapshots.',
    reset: 'Reset',
    eraseAll: 'Erase all Kinetiq data',
    eraseNote:
      'Saved exercises came from the catalog and can be downloaded again. Nothing is uploaded anywhere, so there is no account to close and nothing sitting on someone else server to delete.',
    builtWith: 'Built with React Native and Expo.',
    eraseTitle: 'Erase everything?',
    eraseMessage:
      '{activities} and {routines} will be deleted from this device, along with your units, appearance, goal and reminder settings. You will be left with an empty app, and the demo data does not come back.',
    eraseConfirm: 'Erase everything',
    keepMyData: 'Keep my data',
    activityCount_one: '{count} workout',
    activityCount_other: '{count} workouts',
    routineCount_one: '{count} routine',
    routineCount_other: '{count} routines',
    kindLift: 'Workouts',
  },
  // --- group-c ---
  workoutFlow: {
    justNow: 'just now',
    hoursAgo_one: '{count}h ago',
    hoursAgo_other: '{count}h ago',
    daysAgo_one: '{count}d ago',
    daysAgo_other: '{count}d ago',
    weeksAgo_one: '{count}w ago',
    weeksAgo_other: '{count}w ago',
    thisWeek: 'This week',
    lastWeek: 'Last week',
    weekOf: 'Week of {date}',
    elapsedA11y: 'Elapsed {time}',
    setsDone: '{done} of {planned} {word} done',
    repCount_one: '{count} rep',
    repCount_other: '{count} reps',
  },
  // --- end group-c ---
  session: {
    thisSet: 'This set',
    addNotChanged:
      'That exercise did not go in: it is either already in this workout, or the workout has ended. Nothing was changed.',
    addFailed: 'Your phone could not store that exercise, so it was not added. Your workout is unchanged.',
    discardFailed: 'Your phone could not delete the session. The workout is still here.',
    saveFailed: 'Your phone could not save the session. Try again.',
    saveFailedKept: 'Your phone could not save the session. Nothing was lost: try again.',
    noneTitle: 'No workout in progress',
    noneMessage:
      'Start one from a routine and it shows up here, with your last numbers beside every set.',
    pickRoutine: 'Pick a routine',
    leave: 'Leave the workout. It keeps running.',
    leaveHint: 'Returns to the previous screen. The session is not lost.',
    setWord_one: 'set',
    setWord_other: 'sets',
    exerciseWord_one: 'exercise',
    exerciseWord_other: 'exercises',
    running: 'Running',
    paused: 'Paused',
    finishA11y: 'Finish and save this workout',
    awayNotice:
      'Away for {time}. The clock only counts while the app is open, and rest resumed from where it was.',
    exercises: 'Exercises',
    emptyTitle: 'No exercises in this workout',
    emptyMessage:
      'Add one from the library and it is stored on the device straight away.',
    addAnExercise: 'Add an exercise',
    notesTitle: 'Session notes',
    notesEyebrow: 'Saved with the workout',
    notesEmpty: 'How did it go? Added to the workout when you finish.',
    discard: 'Discard',
    finish: 'Finish',
    discardTitle: 'Discard this workout?',
    discardMessage_one:
      '{count} set goes unrecorded, and this workout will not appear in your history or your totals. There is no undo.',
    discardMessage_other:
      '{count} sets go unrecorded, and this workout will not appear in your history or your totals. There is no undo.',
    discardConfirm: 'Discard workout',
    finishTitle: 'Finish this workout?',
    finishPartial:
      '{left} of {planned} {word} left un-ticked. Un-ticked work is not recorded: the workout saves what you completed.',
    finishAll: 'All {planned} sets are done. This becomes a workout in your history.',
    finishConfirm: 'Finish and save',
    thisExercise: 'This exercise',
    notesLabel: 'Notes',
    notesPlaceholder: 'Bar speed, sleep, that nagging shoulder.',
    notesHint: 'Stored on this device, with the workout.',
    recordOne: 'Personal record',
    recordMany: '{count} personal records',
    seeInHistory: 'See it in history',
    elapsed: 'Elapsed',
    sets: 'Sets',
    volumeIn: 'Volume ({unit})',
    noPrevious: 'No previous sessions of this exercise',
    noLoadRecorded: 'Last time, no load recorded',
    bodyweight: 'bodyweight',
    lastTime: 'Last time {load}',
    moreSetsOf_one: '{count} more set of {name}',
    moreSetsOf_other: '{count} more sets of {name}',
  },
  profileScreen: {
    editProfileHint: 'Opens your name, height and birth year',
    athlete: 'Athlete',
    thisWeekLabel: 'this week',
    readingHistory: 'Reading your history…',
    goalSpare: 'Goal met with {phrase} to spare.',
    goalLeftText: '{phrase} left to hit your weekly goal.',
    sessionWord_one: 'session',
    sessionWord_other: 'sessions',
    dayWord_one: 'day',
    dayWord_other: 'days',
    bestStreak: 'Best streak {count} {word}',
    app: 'App',
    trainingPrefs: 'Training preferences',
    notifications: 'Notifications',
    yourData: 'Your data',
    aboutTitle: 'About Kinetiq',
    headlineNothing: 'Nothing logged this week',
    headlineGoalMet: 'Goal met',
    headlineOnTrack: 'On track',
    headlineStarting: 'Getting started',
  },

  workoutTab: {
    quickStart: 'Quick start',
    startEmpty: 'Start empty workout',
    emptyWorkoutName: 'Workout',
    orderRecent: 'Recent',
    orderName: 'A-Z',
    saved: 'Saved',
    new: 'New',
    routinesError: 'Could not open your routines',
    emptyTitle: 'No routines yet',
    emptyMessage:
      'Pick a few exercises, set your reps and weights, and the next six weeks sort themselves out.',
    createRoutine: 'Create a routine',
    resumeA11y: '{name} in progress. {done} of {total} sets done. Resume.',
    trainingNow: 'Training now',
    setsOfTotal: '{done}/{total} sets',
    doneTimes: '{count}× done',
  },
  // --- group-d ---
  systemScreens: {
    openTab: 'Open a tab',
    unknownError: 'Unknown error',
  },
  // --- end group-d ---
  settingsScreen: {
    namePlaceholder: 'Athlete',
    heightRequired: 'Height is needed for calorie estimates.',
    numbersOnly: 'Numbers only.',
    heightRange: 'Must be between {min} and {max} cm.',
    birthYearRequired: 'Birth year is needed for calorie estimates.',
    birthYearDigits: 'Four digits, like 1994.',
    birthYearRange: 'Must be between {min} and {max}.',
    nameTooShort: 'A name needs at least two characters.',
  },
  setRow: {
    bodyweight: 'bodyweight',
    setRepsAt: 'Set {n}: {reps} reps at {weight}',
    opensEditor: 'Opens the set editor.',
    reps: 'Reps',
    weightIn: 'Weight ({unit})',
    setWeight: 'Set {n} weight: {weight}',
    bodyweightShort: 'BW',
    markNotDone: 'Mark set {n} not done',
    completeSet: 'Complete set {n}',
    blockA11y: '{name}. {done} of {total} sets done.',
    isCurrent: 'This is the current exercise.',
    makeCurrent: 'Makes it the current exercise.',
    addSet: 'Add a set',
    skip: 'Skip',
    skipNamed: 'Skip {name}',
    remove: 'Remove',
    removeNamed: 'Remove {name} from this workout',
    thisSet: 'This set',
    weightInUnit: 'Weight in {unit}',
    bodyweightNote: 'Bodyweight: no external load recorded.',
    rpe: 'RPE',
    rpeNote: 'Effort out of 10. Zero means you did not note it.',
    removeThisSet: 'Remove this set',
    restLess: 'Rest fifteen seconds less',
    restMore: 'Rest fifteen seconds longer',
    skipRest: 'Skip the rest',
    removeExerciseTitle: 'Remove this exercise?',
    removeWithSets_one:
      '{name} and the {count} set already banked against it come out of this workout. Nothing else changes.',
    removeWithSets_other:
      '{name} and the {count} sets already banked against it come out of this workout. Nothing else changes.',
    removePlain: '{name} comes out of this workout. Nothing else changes.',
  },
  perms: {
    granted: 'Granted',
    notGranted: 'Not granted',
  },

  notif: {
    title: 'Notifications',
    inAppAlerts: 'In-app alerts',
    masterOffBecause:
      'This is off because the system has not allowed notifications yet. Your rest timer still counts down on screen: you just have to look at it.',
    restBody:
      'Armed the moment a rest starts and fired when it ends, so the phone can go face-down between sets. Skip the rest and the alert is retracted with it.',
    restNote:
      'Follows the timer on the Training screen. There is no separate length here, and there is deliberately no second switch: two controls for one countdown is how you end up with a rest timer that says 90 and buzzes at 60.',
    timeNote: 'Local time, and it follows you across time zones.',
    noDaysWarning: 'No days selected, so nothing is scheduled. Pick at least one.',
    timeWord_one: 'time',
    timeWord_other: 'times',
    daysSummary: '{days} · {count} {word} a week.',
    blocked: 'The system is blocking notifications.',
    scheduleAt: '{days} at {time}.',
    sendNotifications: 'Send notifications',
    onBody: 'Rest timer and weekly reminder.',
    offBody: 'Nothing will be delivered, and nothing will be scheduled.',
    restTimer: 'Rest timer',
    sendTest: 'Send a test alert',
    weeklyReminder: 'Weekly reminder',
    remindMe: 'Remind me to train',
    time: 'Time',
    systemAllowed: 'Allowed. Everything below can be delivered.',
    systemDenied:
      'If this is wrong, open the system Settings, tap Kinetiq, then Allow Notifications. This screen re-reads the answer whenever you come back to the app.',
    systemPermission: 'System permission',
    maySend: 'Kinetiq may send notifications',
    mayNotSend: 'Kinetiq may not send notifications',
    askForPermission: 'Ask for permission',
    waiting: 'Waiting for your answer',
    offOnScreen: 'Notifications are off on this screen.',
    oneNudge: 'One nudge on the days you choose.',
    noDaysSelected: 'Turned on, but no days selected.',
    everyDay: 'Every day',
    noDays: 'No days',
  },
  newRoutine: {
    addOneFirst: 'Add at least one exercise before saving.',
    saveFailed: 'Could not save. Nothing was lost: the routine is still here as you left it.',
    title: 'New routine',
    saving: 'Saving…',
    done: 'Done',
    nameLabel: 'Routine name',
    namePlaceholder: 'Push Day, Leg Day, Full Body B',
    nameA11y: 'Names the routine',
    emptyTitle: 'No exercises yet',
    addExercise: 'Add exercise',
    exercises: 'Exercises',
    rowWord_one: 'row',
    rowWord_other: 'rows',
    plannedVolume: 'Planned volume',
    estTime: 'Est. time',
    discardTitle: 'Discard this routine?',
    discardWithItems_one:
      '{count} exercise has not been saved. Nothing has been created yet, so discarding removes the whole draft.',
    discardWithItems_other:
      '{count} exercises have not been saved. Nothing has been created yet, so discarding removes the whole draft.',
    discardEmpty: 'Nothing has been saved yet, so leaving now discards the name and notes.',
    discard: 'Discard',
  },

  exerciseList: {
    searching: 'Searching…',
  },

  itemEditor: {
    loadingDetails: 'Loading the exercise details…',
    imageA11y: 'How to do {name}',
    sets: 'Sets',
    reps: 'Reps',
    repsSuffix: 'reps',
    editHint: 'Changes the sets, reps, weight, rest and note',
    weightIn: 'Weight ({unit})',
    weightPerSet: 'Weight per set in {unit}',
    bodyweightShort: 'BW',
    restBetweenSets: 'Rest between sets',
    fromLibrary: 'From the library',
    remove: 'Remove',
    zeroRestNote: 'Zero means no rest timer starts during this exercise.',
    note: 'Note',
    notePlaceholder: 'A cue for mid-set: elbows tucked, pause at the chest',
    noteHint: 'Shown on this exercise during the workout.',
    noteCount: '{count} of {max}',
  },



  trainingPrefs: {
    title: 'Training',
    restTimer: 'Rest timer',
    appliesToNew: 'Applies to new sessions',
    restAfterSet: 'Rest after each set',
    duringSession: 'During a session',
    autoStartRest: 'Start rest automatically',
    haptics: 'Haptics',
    restCountdown: 'Rest countdown ticks',
    restCountdownHint: 'A tick in each of the last 3 seconds of a rest, then a buzz when it ends.',
    weeklyGoal: 'Weekly goal',
    sessionsPerWeek: 'Sessions per week',
  },

  boot: {
    keepMyData: 'Keep my data',
    eraseAndStart: 'Erase and start over',
    tryAgain: 'Try again',
    resetLocalData: 'Reset local data',
    openDeviceSettings: 'Open device settings',
    takingLonger: 'Taking longer than expected',
    eraseWarning: 'Erasing removes your history, routines and settings. It cannot be undone.',
    couldNotStart: 'Kinetiq could not start',
    couldNotStartDetail:
      'Something failed before the app could open its local storage. Your data has not been changed.',
    stopped: 'KINETIQ STOPPED',
    couldNotStartCorrectly: 'Kinetiq could not start correctly',
    screenError: 'This screen hit an error',
    goToHome: 'Go to Home',
    notFound: 'Not found',
    noScreenHere: 'There is no screen here',
  },

  picker: {
    title: 'Add exercises',
    subtitle: 'Searched live from the exercise library',
    search: 'Search',
    placeholder: 'Squat, curl, lat pulldown',
    searchHint: 'Filters the exercise library as you type',
    clearFilter: 'Clear filter',
    unreachable: 'The library is unreachable',
    loadMore: 'Load more',
    done: 'Done',
  },


  misc: {
    loading: 'Loading',
    notFoundBody:
      'The link you followed points somewhere this app does not have. Your routines, history and settings are untouched.',
    muscleTagging:
      'Muscle assignments come from the library own tagging: a guide to the movement emphasis, not an anatomical claim about your body.',
    midSessionNote:
      'You are mid-session, so the schedule was saved but not re-armed: your rest timer keeps the alert it already has. It updates when the session ends.',
    restDefaultBody:
      'Where a new rest countdown starts. Change it for one exercise inside a routine, or skip it mid-session: this is only the default.',
    autoStartFootnote:
      'Auto-start is the option to turn off if you rest by feel: a countdown you did not start is a countdown you will silence.',
    goalBody:
      'The ring on Home and the target line on Progress. Changing it never rewrites history: only what counts as on target from now on.',
    persistFailedBody:
      'Your phone refused a write, so these sets exist only until the app closes. Keep going: it will retry with every set, but do not force quit.',
    fatalBody:
      'Your saved workouts and routines were not changed. Restarting the app will usually fix this.',
    routeErrorBody:
      'Your workouts, routines and settings were not affected. You can try the screen again, or go back and carry on elsewhere in the app.',
    opensRoutine: 'Opens the routine',
    opensExercise: 'Opens the exercise details',
    notSaving: 'Not saving to this device',
    couldNotSaveThat: 'Could not save that',
    opensWorkoutInProgress: 'Opens the workout in progress',
    rest: 'Rest',
  },
  push: {
    channel: 'Training',
    restComplete: 'Rest complete',
    restNext: '{name} is done. Next up: {next}.',
    restLast: '{name} is done: you are finished here.',
    testTitle: 'Notifications are working',
    testBody: 'This is the same channel your rest-timer alerts use.',
    reminderTitle: 'Time to train',
    reminderBody: 'Your session is waiting. Even a short one keeps the streak alive.',
  },

  states: {
    offlineTitle: 'You are offline',
    timeoutTitle: 'The server took too long',
    genericTitle: 'Could not load this',
    offlineMessage:
      'Anything you have saved is still here. Remote exercises and new images will come back as soon as you reconnect.',
    genericMessage: 'This one did not respond. Trying again usually works.',
    activityGone: 'That workout is no longer stored.',
    autoStartOn: 'Counting down the moment you complete a set.',
    autoStartOff: 'You tap to begin resting, so a phone call between sets costs you nothing.',
    pickerNoMatch: 'Nothing matches that',
    pickerStart: 'Start typing',
    pickerNoMatchBody:
      'The library is a real remote catalogue, so an unusual name may simply not be in it. Try a plainer word, or clear the filter.',
    pickerStartBody: 'Type part of an exercise name and results appear as you go.',
    alreadyInRoutine: 'Already in this routine',
    addsToRoutine: 'Adds this exercise to the routine',
    resetFailedBody:
      'Kinetiq still could not open local storage, and clearing it did not help. Reinstalling the app is the remaining option; your data has already been removed.',
    stillStartingBody:
      'Kinetiq is still starting up. This usually means local storage is busy or was left in a state it cannot read.',
  },
  // --- foundation ---
  headerActions: {
    add: 'Add',
    more: 'More options',
    play: 'Start',
    delete: 'Delete',
    save: 'Save',
    done: 'Done',
    cancel: 'Cancel',
  },
  textInput: {
    clear: 'Clear {label}',
  },
  settingsExtra: {
    hapticsHint: 'Buzz on a completed set, a new record, a finished workout and a met goal.',
  },
  routineItemA11y: {
    moveUp: 'Move {name} up',
    moveDown: 'Move {name} down',
    remove: 'Remove {name} from this routine',
  },
  // --- end foundation ---
  dataTransfer: {
    title: 'Your data',
    exportTitle: 'Export',
    exportWorkouts: 'Workout history (JSON)',
    exportSets: 'Every set, as a table (CSV)',
    exportRoutines: 'Routines (JSON)',
    exportFooter:
      'Files open in the share sheet: save them, send them to another device, or share them with an AI chat. Weights are always in kilograms. Demo workouts are left out.',
    exportFailed: 'The export could not be created. Try again.',
    importTitle: 'Import routines',
    pasteClipboard: 'Paste from clipboard',
    chooseFile: 'Choose a file…',
    importFooter:
      'Reads a Kinetiq routines file, or the answer an AI wrote from the instructions below. You see every routine before anything is saved, and imported routines never replace the ones you have.',
    importFailed: 'Nothing to import',
    aiTitle: 'Create routines with AI',
    aiCopy: 'Copy AI instructions',
    aiCopied: 'Instructions copied',
    aiFooter:
      'Paste the instructions into any AI chat, add what you want ("a 4-day upper/lower split, 45 minutes"), copy its answer, then tap Paste from clipboard. To change existing routines, send it your routines export as well.',
    aiPrompt:
      'You are writing gym routines for the Kinetiq app. Reply with ONLY a JSON document in exactly this shape, with no other text:\n\n{\n  "format": "kinetiq.routines",\n  "version": 1,\n  "routines": [\n    {\n      "name": "Push Day",\n      "items": [\n        { "exerciseId": "wger:73", "exerciseName": "Bench Press", "sets": 4, "reps": "8-10", "weightKg": 60, "restSeconds": 120, "notes": "Pause the bar on the chest" }\n      ]\n    }\n  ]\n}\n\nRules:\n- exerciseName is required. Use the common English name of the exercise.\n- exerciseId is optional. If you can browse the web, find the exercise in the wger catalog (https://wger.de/api/v2/exerciseinfo/?name__search=bench%20press&language__code=en) and write "wger:" followed by its id. If you cannot, leave exerciseId out. Never guess an id.\n- sets: 1 to 20. reps: a number or a range with a plain hyphen, such as "8-12". weightKg: 0 to 450, and 0 for bodyweight or when unsure. restSeconds: 0 to 600.\n- notes is optional: a short form cue for that exercise, at most 200 characters, or null.\n- One routine per training day, with exercises in the order they are performed.\n- If I give you an existing Kinetiq routines file, keep its exerciseId values.\n\nWhat I want:\n',
    previewTitle: 'Import',
    matching: 'Looking up exercises…',
    matchFailed: 'The exercises could not be looked up.',
    nothingStaged: 'Nothing to import. Go back and paste or choose a file.',
    importCount_one: 'Import {count} routine',
    importCount_other: 'Import {count} routines',
    nothingToImport: 'No routine has an exercise that could be found',
    saveFailed: 'The routines could not be saved. Nothing was changed.',
    untitledRoutine: 'Imported routine {number}',
    setsReps: '{sets} × {reps}',
    itemTargets: '{weight} · rest {rest} s',
    matchedFrom: 'Closest match for "{name}"',
    missingNotFound: 'Not in the catalog: will be skipped',
    missingOffline: 'Needs a connection to look up: will be skipped',
    missingSummary_one: '{count} exercise will be skipped.',
    missingSummary_other: '{count} exercises will be skipped.',
    errorEmpty: 'The clipboard is empty.',
    errorNotJson: 'This is not a routines file. Ask the AI to reply with the JSON only, then copy it again.',
    errorNoRoutines: 'No routines with exercises were found in it.',
    errorTooLarge: 'The file is too large to be a routines file.',
    errorUnreadable: 'The file could not be read.',
    issueTooMany: 'Only the first {count} routines are shown.',
    issueRoutineSkipped: 'Routine {routine} has no exercises and was left out.',
    issueItemSkipped: 'Routine {routine}, exercise {item}: no name, left out.',
    issueDefaults: 'Routine {routine}, exercise {item}: missing sets or reps, defaults used.',
  },
  // --- followups ---
  followups: {
    ringA11y: '{percent} percent complete',
    a11yLift: '{title}. {sets}, {volume} total volume, {duration}.',
    a11yPlain: '{title}. {duration}.',
  },
  // --- end followups ---
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
