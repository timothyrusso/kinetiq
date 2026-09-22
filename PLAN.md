# Kinetiq UI overhaul plan

This file is the prompt. Each phase below is written so it can be handed to an agent on its
own. Every agent reads "Part 1: shared rules" first, then its own phase. Nothing outside this
file and `CLAUDE.md` is assumed.

Goal in one sentence: make Kinetiq look and feel like a native iOS app on iOS and a native
Android app on Android, using what Expo ships (Expo UI, expo-router native headers, native
sheets), with one consistent layout system and information shown as structured elements
instead of concatenated text.

Out of scope for this plan: a colour or motion pass, porting the device gates to Android,
snapshot reconciliation and the other items in `REVIEW.md`. Do not start them.

---

## Part 1: shared rules (every agent reads this)

### 1.1 Project facts

- Expo SDK 57, expo-router 57.0.22, `@expo/ui` 57.0.19, react-native-screens 4.26,
  React Native 0.86, new architecture on, TypeScript strict, TanStack Query, SQLite.
- Path alias `@/*` maps to `src/*`.
- Tabs are already `NativeTabs` (`app/(tabs)/_layout.tsx`): `index`, `activities`,
  `workout`, `exercises`, `profile`.
- The root `Stack` in `app/_layout.tsx` hides the header; every nested layout repeats
  `headerShown: false`; `src/ui/Screen.tsx` re-enables the native header per screen through
  `DetailScreen`. This is what the foundation phase replaces.
- Theme: two hand-authored palettes, dark and light, in `src/theme/theme.ts`. Spacing, radii and
  `screenGutter` (20) live in `src/theme/tokens.ts`. Type variants live in `src/ui/Text.tsx`.
  Bottom insets live in `src/ui/insets.ts`.
- Gates: `npm run check` (typecheck, jsx comments, gps, debounce, dashes, i18n parity, hooks).
  Device gates `qa:crud`, `qa:network`, `qa:pagination`, `qa:offline`, `qa:faults` run on the
  iPhone 17 Pro simulator with Metro on port 8083. Port 8081 belongs to another project. The QA
  scripts navigate with `kinetiq://home`, `kinetiq://dev`, `kinetiq://workout/cardio` and match
  on user-visible copy, so route paths and copy they touch must survive.
- Devices available on this machine: iPhone 17 Pro simulator (booted), Android emulators
  `Pixel_9_Pro`, `Pixel_Tablet`, `Medium_Phone_API_36.1`. `adb`, `xcrun simctl` and
  `agent-device` are installed.

### 1.2 Rules from CLAUDE.md that still apply, unchanged

- Never type an em dash (U+2014) or en dash (U+2013) anywhere, including commit messages and
  this plan's derivatives. Use a colon, comma, parentheses or middle dot.
- All user-facing copy, including accessibility labels, goes through `src/i18n/` in both
  English and Italian. Components use `useT()`. Non-React code uses `tr()`. Module-level tables
  hold catalog keys, never words. Exceptions: `app/dev.tsx` and the product name.
- One source of truth per measurement. No screen hard-codes a number another screen needs.
- Do not add a component library. Components that Expo UI lacks are small files in `src/ui/`,
  written in the spirit of react-native-reusables (composable, unstyled core, tokens for skin),
  never copied from it and never installed from it.
- Do not hand-author SVG glyph paths.

### 1.3 Rules this plan adds (Phase 1 also writes them into CLAUDE.md)

**Platform policy.** Both platforms must feel native. Where Expo UI has a control on one
platform only, the other platform gets a fallback that follows that platform's own conventions
(Human Interface Guidelines on iOS, Material 3 on Android). Never ship the iOS look on Android
or the reverse.

**Expo UI import policy.** Import from `@expo/ui/universal` first. If the control is missing
there, import from `@expo/ui/swift-ui` in a `Name.ios.tsx` file and from
`@expo/ui/jetpack-compose` in a `Name.android.tsx` file, with a shared `types.ts`. If one
platform has nothing, that platform's file is the RN fallback. Callers import
`@/ui/controls/Name` and never see the branch. `Platform.select` for UI structure is not
allowed; it is allowed for single values (a number, a colour).

**Native hosting.** The SDK 57 statement "Expo UI components cannot contain React Native
children" is outdated: `RNHostView` exists. It is still forbidden inside list rows and in
anything that scrolls, because its size matching is fixed at mount and each host is a native
view boundary. Use it only for static, single-instance content, and only when a form-sheet
route cannot do the job.

**Icons.** Three sources: SF Symbols (`sf`) and Material Symbols (`md`) where an Expo UI or
expo-router API takes them (tab bar, `Stack.Toolbar`); MaterialIcons from
`@expo/vector-icons` rendered to an image source for Android `Stack.Toolbar` items; Ionicons via
`@expo/vector-icons` for every other icon in content. Header icon names live in one table,
`src/navigation/headerActions.ts`, keyed by action, with an `sf` name and a `material` name per
row.

**Gutter ownership.** `screenGutter` is the only horizontal edge token. `spacing.xl` must not
be used as a screen or list gutter. On iOS, lists are inset-grouped: the group card owns the
gutter, rows fill the card edge to edge, the pressed highlight fills the row. On Android, the
scroll container owns the gutter and rows fill it edge to edge. Rows never self-pad
horizontally. The lint `scripts/check-layout.js` (Phase 1) fails the build on any
`paddingHorizontal`, `paddingLeft`, `paddingRight`, `marginHorizontal`, `marginLeft` or
`marginRight` whose value is a literal number or `spacing.xl` in `app/**` and `src/ui/**`,
with an allowlist file for the few chart internals that need it.

**Information display.** Metadata is never a joined string. Rows and cards take structured
props (see 1.6) and render them with the display primitives. `joinMiddleDot` may only be used
to build accessibility labels.

**i18n in parallel work.** Each workstream adds its keys inside its own block in `en.ts` and
`it.ts`, delimited by a comment `// --- <workstream> ---`, so branches merge without conflicts.
Never reorder or reformat keys outside your block.

### 1.4 Performance rules

- Every list is a `FlashList` with a stable `keyExtractor`, `getItemType` where rows differ,
  and an `estimatedItemSize` measured, not guessed.
- Row components are `memo`ised and receive primitive or stable props. No inline object or
  arrow function is created per row inside `renderItem`; callbacks come from `useCallback` and
  take the id as argument.
- No `Host`, `RNHostView` or any Expo UI component inside a list row. Chips and badges in rows
  are RN.
- Remote and local raster images go through `expo-image` with `recyclingKey` in lists.
- Motion runs on the UI thread: Reanimated worklets only. No `setState` per frame, no
  `Animated` from `react-native`, no `LayoutAnimation`.
- Data shaping (sorting, grouping, formatting) happens in `useMemo` or in the query layer, never
  in render.
- Budget: no regression against the Phase 0 baseline on either device, and zero dropped frames
  while scrolling each list end to end. Measurement method in 1.7.

### 1.5 Git workflow

- Remote: `origin` is `https://github.com/timothyrusso/kinetiq.git` (public). The tree already
  contains work not yet committed; Phase 0 commits it as the baseline.
- One branch per phase or workstream, named `ui/<phase-or-group>` (for example
  `ui/foundation`, `ui/group-a-tabs`). Branch from `main` after the previous prerequisite phase
  has merged.
- Commit small and often, imperative subject under 72 characters, body explains why. Every
  commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Push the branch and open a pull request into `main` with `gh pr create`. The PR body lists
  the screens touched, links the evidence folder, and ends with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. The owner merges. Agents
  never merge, never force-push, never rebase a pushed branch, never commit to `main` directly
  after Phase 0.
- Never commit anything under `artifacts/`, `out/` or `*.log`; they are ignored.

### 1.6 Display primitives and row API (built in Phase 1, used everywhere after)

All in `src/ui/display/`:

| Primitive | Purpose | Props (minimum) |
|---|---|---|
| `StatTile` | One number that matters: big numeral, small uppercase label, optional unit and trend | `value`, `label`, `unit?`, `trend?: { delta, direction }`, `emphasis?: 'hero' \| 'default'` |
| `MetaLine` | Row of icon plus value items, replaces every middle-dot string | `items: { icon: IoniconName; label: string; a11y?: string }[]`, `wrap?` |
| `TagRow` | Chips for taxonomy (muscles, equipment, activity kind) | `tags: { key: string; label: string; tone?: Tone; onPress? }[]`, `max?` (overflow shows `+n`) |
| `SectionHeader` | Section title with optional trailing action | `title`, `action?: { label; onPress }`, `counter?` |
| `ActivityCard` | One activity: kind tone, headline stat, MetaLine, optional map or chart thumbnail | `activity`, `thumbnail?: 'map' \| 'chart' \| 'none'`, `onPress` |

Existing `Chip`, `Badge`, `Card` stay and are used underneath. `Card` gains a platform skin:
inset-grouped on iOS (radius `lg`, `surface`, hairline separators inside), Material tonal
surface on Android (radius `md`, `surfaceRaised`, no separators). The skin comes from a new
`platformSurface` token set in `src/theme/tokens.ts`, not from conditionals in screens.

Row API in `src/ui/rows.tsx`: the `subtitle: string` prop is removed from `ListRow`,
`RoutineRow`, `ExerciseRow` and `ActivityRow`. They take `meta?: MetaItem[]` and
`tags?: Tag[]`. TypeScript then points every caller that still passes a string.

### 1.7 Definition of done and evidence protocol

A workstream is done when all of the following hold. Report anything that does not, do not
soften it.

1. `npm run check` is green, including the new `check:layout`.
2. The five device gates are green on the iPhone 17 Pro simulator with Metro on 8083.
3. Screenshots exist for every touched screen: before and after, iPhone 17 Pro and Pixel 9 Pro,
   dark and light. Eight images per screen. Naming:
   `artifacts/evidence/<branch>/<screen>/<before|after>-<ios|android>-<dark|light>.png`. The
   folder is ignored by git; attach or summarise in the PR body and keep the folder for the
   owner's review.
4. Performance: cold start and scroll frame rate measured as below on both devices and written
   to `artifacts/evidence/<branch>/perf.md`, compared to `artifacts/evidence/baseline/perf.md`.
   No regression, zero dropped frames.
5. Both platforms were exercised by hand with `agent-device` on the touched screens: every
   header action works, every sheet opens and dismisses, back navigation returns to the right
   place, and the screen looks correct in both colour schemes.
6. No new `TODO`, no dead exports, no file left that nothing imports.

**Perf measurement method.** Use the same build type before and after (the dev client is fine;
only the comparison matters).

- Cold start, Android: `adb shell am force-stop app.kinetiq.mobile` then
  `adb shell am start -W -n app.kinetiq.mobile/.MainActivity` and record `TotalTime`. Five runs, report
  the median.
- Cold start, iOS: `xcrun simctl terminate booted app.kinetiq.mobile`, then `xcrun simctl launch booted
  app.kinetiq.mobile` and poll `agent-device` every 100 ms for the home screen title; record the
  elapsed time from launch to first hit. Five runs, median.
- Scroll frames: open the dev menu Perf Monitor, then with `agent-device` swipe each list from
  top to bottom and back in five swipes. Screenshot the monitor at the end of each swipe and
  record the lowest UI and JS FPS seen. Zero dropped frames means 60 (or the device's refresh
  rate) on the UI thread for every swipe.

### 1.8 Forbidden actions

- Do not install any dependency without writing the reason in the PR body. Never install a
  component library.
- Do not touch `scripts/qa/*` unless a copy change you made breaks a gate; then update only the
  string the gate matches.
- Do not change route paths that the QA scripts deep-link to.
- Do not edit files owned by another running workstream (see Part 3 ownership table).
- Do not run `git stash`, `git checkout -- .`, `git reset --hard` or anything that discards work.

---

## Part 2: sequential phases

### Phase 0: baseline (one agent, about 1 hour)

Branch: none, this commits to `main` once.

1. Verify `git status` shows the expected modified files and the untracked `PLAN.md`,
   `REVIEW.md`, `scripts/check-hooks.js`, `src/i18n/tr.ts`. Verify `artifacts/ios-build-1.log`
   is staged for deletion.
2. Run `npm run check`. If it fails, fix only what it reports and note the fix in the commit
   body.
3. Commit everything as `chore: baseline before UI overhaul` and push `main` to `origin`.
4. Take the baseline evidence: all eight screenshots for every screen in the app (list in
   Part 3), stored under `artifacts/evidence/baseline/<screen>/`. Use `before-*` names.
5. Measure the perf baseline per 1.7 on both devices for the five tab lists, workout history
   and the routine detail item list. Write `artifacts/evidence/baseline/perf.md`.
6. Report: the commit hash, the screenshot count, and the perf table.

### Phase 1: foundation (one agent, about 2 to 3 days)

Branch: `ui/foundation`. Everything in Part 3 depends on this phase, so it must be complete,
not partial. Work in the order below; each numbered item is a commit or a few.

**1. Tokens and lint.**
- Add `platformSurface` tokens (radius, surface colour key, separator style, row pressed
  style) for iOS and Android to `src/theme/tokens.ts` and expose them from the theme.
- Write `scripts/check-layout.js` per 1.3 and add `check:layout` to the `check` chain in
  `package.json`. Allowlist: `src/ui/charts/HeatmapCalendar.tsx`, `src/ui/charts/BarChart.tsx`.
- Replace every `spacing.xl` used as a gutter with `screenGutter` (audit list:
  `app/exercise/[id].tsx`, `app/exercise/add.tsx`, `src/ui/rows.tsx`, `src/ui/Sheet.tsx`,
  `src/ui/states.tsx`). Replace the 26 pt gutters in `app/+not-found.tsx` and
  `src/ui/states.tsx`. Make the lint pass.

**2. Navigation and headers.**
- Give each tab its own Stack: move `app/(tabs)/<tab>.tsx` to `app/(tabs)/<tab>/index.tsx`
  with an `app/(tabs)/<tab>/_layout.tsx` that renders a `Stack` with the native header on,
  large title on, `headerLargeTitleShadowVisible: false`, background from the theme. Keep the
  `NativeTabs.Trigger` names so `kinetiq://home` still resolves; verify with the QA deep links.
- Remove `headerShown: false` from every nested layout and from the root stack; the native
  header is the default everywhere. Screens that must be headerless (live session, live cardio)
  opt out explicitly with `Stack.Screen options={{ headerShown: false }}` and keep their own
  close and pause controls in content.
- Delete `CollapsibleHeader`, `CollapsibleHero`, `BarAction`, `BarBackButton`,
  `useHeaderCollapse` and the custom bar styles from `src/ui/Screen.tsx` and
  `src/ui/animation.ts`. `Screen` becomes a thin wrapper: background, safe area handling,
  scroll container with the platform gutter rule, `contentInsetAdjustmentBehavior="automatic"`
  on iOS so the large title collapses natively.
- Hero content (streak, weekly goal, today's summary) moves into the first content block of the
  tab screen, built with `StatTile` and `TagRow`.
- Subtitles: the native title has one line. Move every subtitle into the first content line of
  the screen as a `MetaLine`. Delete the custom `headerTitle` two-line renderer.
- Back button: delete the `headerLeft` override so the platform back button and its long-press
  menu return. Where a screen needs a custom back behaviour (`app/routine/new.tsx` discard
  guard), use `usePreventRemove` from `@react-navigation/native` instead of replacing the
  button.
- Media detail screens (`app/exercise/[id].tsx`, `app/activity/[id].tsx`) keep
  `headerTransparent` with the blur effect, large title off.
- Exercises tab: mount `Stack.SearchBar` in the header and wire it to the existing
  `exerciseFilters` debounce logic. Remove the in-content search field. Keep the filter
  behaviour that `scripts/debounce-check.ts` asserts.

**3. Header actions.**
- Create `src/navigation/headerActions.ts`: a table keyed by action (`settings`, `filter`,
  `add`, `more`, `play`, `delete`, `save`, `done`, `edit`, `share`), each row with an SF Symbol
  name, a MaterialIcons name, and an i18n key for the accessibility label.
- Create `src/navigation/HeaderAction.tsx` that renders `Stack.Toolbar.Button` for an action:
  `icon={{ sf }}` on iOS; on Android an image source produced once at app start from
  `MaterialIcons.getImageSource(name, 24, tint)` and cached in a module map (prefetch all rows in
  `app/_layout.tsx` before the first stack renders; render nothing for a row until its source
  is ready). Text actions (`save`, `done`) render a label, not an icon, on both platforms.
- Option menus in headers use `Stack.Toolbar.Menu` with `Stack.Toolbar.MenuAction` children.
- Replace every `headerRight` render prop and every `right={...}` on `DetailScreen` with
  `Stack.Toolbar placement="right"` children, one `HeaderAction` per action. No wrapper `Row`,
  no gap, no 44 pt discs. Verify on both devices that the trailing inset is the platform's own.

**4. Modals and sheets.**
- Inventory every use of `Sheet`, `ConfirmSheet`, `OptionSheet` (files:
  `app/(tabs)/activities.tsx`, `app/(tabs)/exercises.tsx`, `app/activity/[id].tsx`,
  `app/routine/[id].tsx`, `app/routine/new.tsx`, `app/settings/about.tsx`,
  `app/workout/cardio.tsx`, `app/workout/history.tsx`, `app/workout/session.tsx`,
  `src/ui/exercisePicker.tsx`, `src/ui/routineItems.tsx`) and classify each as confirm,
  option menu or editor.
- Confirms become `Alert` / `ConfirmationDialog` from Expo UI (universal where available,
  otherwise the platform file pattern); destructive actions are marked destructive so iOS
  colours them red and Android orders them per Material.
- Option menus become `Stack.Toolbar.Menu` when triggered from the header, or Expo UI
  `ContextMenu` when triggered from content.
- Editors (routine item editor, exercise filters, exercise picker, anything with a form) become
  routes under `app/` presented with `presentation: 'formSheet'`, `sheetGrabberVisible: true`,
  `sheetAllowedDetents` chosen per editor (`[0.5, 1]` for pickers, `'fitToContents'` for short
  forms), `sheetCornerRadius` from tokens. They read their input from route params and write
  back through the existing stores or queries, never through a callback param.
- Delete `src/ui/Sheet.tsx`, `src/ui/sheetPresence.ts` and `useSheetDrag` in
  `src/ui/animation.ts` once nothing imports them.

**5. Expo UI controls and platform fallbacks.**
Create `src/ui/controls/` with one folder per control, each with `types.ts` and either a single
`index.tsx` (universal) or `index.ios.tsx` plus `index.android.tsx`:

| Control | iOS | Android |
|---|---|---|
| `Switch` | universal `Switch` | universal `Switch` |
| `Slider` | universal `Slider` | universal `Slider` |
| `Picker` | universal `Picker` | universal `Picker` |
| `Button` | universal `Button` for primary and secondary variants; RN `Pressable` build for the `ghost` and `danger` variants Expo UI lacks, styled to HIG | same rule, Material variants |
| `SegmentedControl` | swift-ui `Picker` with `pickerStyle('segmented')` (exists today in `controls.tsx`) | jetpack-compose `SingleChoiceSegmentedButtonRow` |
| `Stepper` | swift-ui `Stepper` | RN fallback: Material outlined icon buttons with a centred value, long-press repeat kept |
| `Chip` | RN fallback (SwiftUI has none): HIG capsule | jetpack-compose `Chip` for filter chips in rails; RN `Chip` inside list rows (rule 1.4) |
| `TextInput` | universal `TextInput` | universal `TextInput` |
| `DatePicker` | swift-ui `DatePicker` | jetpack-compose `DatePicker` |

The old `src/ui/controls.tsx`, `src/ui/Button.tsx` and `src/ui/TextField.tsx` are reduced to
re-exports during the migration and deleted at the end of this phase. `SegmentedControlDrawn`
is deleted (Android now has a native control).

**6. Settings-style screens.** `app/settings/index.tsx`, `notifications.tsx`, `training.tsx`,
`about.tsx` and `app/permissions.tsx` are rebuilt on universal `List`, `ListItem` and
`FieldGroup` with Expo UI `Switch`, `Picker` and `Stepper` inline. These five are the only
screens allowed to use a native list container. Verify each toggle persists through the
settings store as before.

**7. Display primitives and row API.** Build the five primitives from 1.6 in `src/ui/display/`.
Apply the `Card` platform skin. Change the row API as described and fix every caller the
compiler flags (this is the bulk of the migration; it is fine for this phase to convert callers
mechanically, the groups in Part 3 refine the content).

**8. Deletions.** Remove `src/ui/TabBar.tsx` except `ActiveWorkoutPill`, which moves to
`src/ui/workout.tsx`. Remove any `Platform.OS` branch in `src/ui/` that the platform file
pattern replaced. Run a dead-export check (`npx ts-prune` or an equivalent one-off script, not
added to the repo).

**9. CLAUDE.md.** Update the Icons, Native components and Layout sections to match 1.3, add a
short Performance section from 1.4, and remove the sentence saying Expo UI cannot contain RN
children. Keep the file's tone and length.

**10. Evidence and PR.** Run the full definition of done (1.7) for every screen in the app,
since this phase touches all of them. Open the PR.

---

## Part 3: parallel workstreams (after `ui/foundation` merges)

Four agents, one branch each, started at the same time. Each group owns the files in its row and
must not edit files in another row. Shared files (`src/ui/**`, `src/theme/**`, `src/i18n/*.ts`,
`src/navigation/**`) may be edited only by adding: new keys in your own i18n block, new
variants on a primitive behind a new prop with a default, new rows in `headerActions.ts`. If a
group needs a change to a shared file that is not additive, it stops and reports.

| Group | Branch | Owns | Screens |
|---|---|---|---|
| A: tabs | `ui/group-a-tabs` | `app/(tabs)/**` | Home (`index`), Activities, Workout, Exercises, Profile |
| B: details and editors | `ui/group-b-details` | `app/exercise/**`, `app/routine/**`, `app/activity/**`, `src/ui/routineItems.tsx`, `src/ui/exercisePicker.tsx` | Exercise detail, Add exercise, Routine detail, New routine, Activity detail, the form-sheet editors created in Phase 1 for these |
| C: workout flow | `ui/group-c-workout` | `app/workout/**`, `app/progress/**`, `src/ui/workout.tsx`, `src/ui/charts/**` (token restyle only) | Session, Cardio, History, Progress |
| D: settings and system | `ui/group-d-settings` | `app/settings/**`, `app/permissions.tsx`, `app/+not-found.tsx`, `app/dev.tsx`, `src/ui/states.tsx`, `src/ui/RouteErrorScreen.tsx` | Settings, Notifications, Training, About, Permissions, Not found, Dev console, empty and error states |

### Per-screen checklist (every group applies it to every screen it owns)

1. **Header.** Native, large title where the screen is a list or hub, inline where it is a
   detail. Actions through `HeaderAction` only. No leftover custom bar. Back returns to the
   right place on both platforms; on Android the system back gesture does the same.
2. **Gutter.** No horizontal padding literal in the file. iOS inset-grouped, Android
   edge-to-edge, per 1.3. Vertical rhythm from `spacing` only; every block separated by at least
   `spacing.md`, sections by `spacing.xxl`.
3. **Information.** Every piece of metadata is a `StatTile`, `MetaLine`, `TagRow` or `Badge`.
   Muscles and equipment are tags, tappable where a filter exists. Counts and durations are
   `StatTile` when they are the point of the screen, `MetaLine` items when they are context.
   Activity kind is a tone, not a word, wherever the kind is already obvious from the icon.
4. **Controls.** Every switch, slider, stepper, segmented control, picker and date picker comes
   from `src/ui/controls/`. No RN `Switch`, no hand-drawn segmented control.
5. **Sheets.** Every modal interaction is a native alert, a toolbar or context menu, or a
   form-sheet route.
6. **Empty, loading and error states.** Use `src/ui/states.tsx`. Loading is a skeleton with the
   same layout as the loaded state, never a spinner in the middle.
7. **Performance.** Rules 1.4. Confirm the list's `estimatedItemSize` by measuring a row.
8. **Both schemes, both devices.** Evidence per 1.7.
9. **i18n.** New keys in your block, en and it, accessibility labels included.

### Group-specific notes

**A: tabs.**
- Home: hero block is a `StatTile` row (today's minutes, streak, weekly goal progress) followed
  by "Recent" `ActivityCard`s. Settings action in the header.
- Activities: day headings are `SectionHeader`s with a counter. The filter rail uses the Chip
  control from `src/ui/controls/`. Rows are `ActivityCard` in compact mode or `ActivityRow`
  with `meta` and `tags`; pick one and use it for the whole list.
- Workout: routine rows show exercise count, times completed and last performed as `MetaLine`
  items with icons. The live-workout pill stays and is the only floating element.
- Exercises: search in the header (Phase 1). Rows show primary muscles as a `TagRow` capped at
  two with `+n`, category as a `Badge`. Filter action in the header opens the filter form-sheet.
- Profile: metrics are `StatTile`s in a two-column grid; links are `ListRow`s with chevrons.

**B: details and editors.**
- Exercise detail: hero image with transparent header, then `TagRow`s for muscles and
  equipment, then instructions. The "add to routine" action is a header button.
- Routine detail: header actions are `more` (menu: rename, duplicate, delete) and `play`. Item
  rows show sets, reps and load as `MetaLine` items with icons, primary muscle as a tag. The
  item editor is a form-sheet route.
- New routine: `save` as a text action in the header, disabled until valid; discard guard via
  `usePreventRemove` with a native alert.
- Activity detail: transparent header over the map or chart, `delete` as a destructive header
  action behind a native confirm, summary as a `StatTile` grid, splits or sets in a `Card`.

**C: workout flow.**
- Session and cardio while active: no navigator header, immersive. Controls in content use the
  `Button` control. Transitions between exercises stay on the UI thread. The pre-start and
  finished states use the native header.
- History: header subtitle moves into a `MetaLine` at the top. Sessions are `ActivityCard`s
  grouped under `SectionHeader`s per week.
- Progress: charts unchanged in logic, restyled through tokens only. The period selector is the
  `SegmentedControl` control. Metric summaries are `StatTile`s.

**D: settings and system.**
- Settings screens were rebuilt in Phase 1 on native lists; this group verifies every row,
  fixes spacing inside `ListItem` slots, and makes sure grouped section titles and footers are
  the platform's own.
- Dev console gets the native header; its copy must not change (QA scripts match on it).
- Not found and error screens use `ContentUnavailableView` on iOS via a platform file and an RN
  Material equivalent on Android.

---

## Part 4: hand-off to the owner

There is no automated final pass. When the four PRs are open, the last agent to finish writes
`artifacts/evidence/SUMMARY.md` with:

1. A table of every screen, the group that touched it, and links to its eight screenshots.
2. The perf table: baseline versus after, both devices, every measured list.
3. Anything left out of scope on purpose, and anything a group stopped on and reported.
4. The list of files deleted and the list of new files under `src/ui/`.

The owner reviews the app by hand on both devices and merges.

---

## Appendix A: verified API facts (checked in `node_modules`, SDK 57)

- `Stack.Toolbar` (`placement: 'left' | 'right' | 'bottom'`) with `Stack.Toolbar.Button`,
  `.Menu`, `.MenuAction`, `.Spacer`, `.View`, `.Label`, `.Icon`, `.Badge`,
  `.SearchBarSlot`; also `Stack.Screen.Title`, `Stack.Screen.BackButton`, `Stack.SearchBar`,
  `Stack.Header`. Button `icon` takes an SF Symbol string on iOS; on Android it must be an
  `ImageSourcePropType`, SF names are silently dropped.
- Native stack `presentation` accepts `'formSheet'` and `'pageSheet'` with `sheetAllowedDetents`,
  `sheetGrabberVisible`, `sheetCornerRadius`, `sheetInitialDetentIndex`,
  `sheetLargestUndimmedDetentIndex`, `sheetExpandsWhenScrolledToEdge`, `sheetFooter`, and the
  `sheetDetentChange` event.
- expo-router 57.0.22 does not export a `Modal` component. Form-sheet routes are the native
  modal.
- `@expo/ui/universal` exports: `Host`, `Column`, `Row`, `Text`, `Button`, `ScrollView`,
  `Switch`, `Slider`, `Checkbox`, `BottomSheet`, `Collapsible`, `FieldGroup`, `Icon`, `List`,
  `ListItem`, `Picker`, `RNHostView`, `Spacer`, `TextInput`.
- `@expo/ui/swift-ui` has `Alert`, `ConfirmationDialog`, `ContextMenu`, `Menu`, `Stepper`,
  `DatePicker`, `Section`, `Form`, `List`, `ContentUnavailableView`, `GlassEffectContainer`,
  `Toolbar`, `Chart`, and no `Card` or `Chip`.
- `@expo/ui/jetpack-compose` has `Card`, `ElevatedCard`, `Chip`, `Badge`, `AlertDialog`,
  `DropdownMenu`, `ModalBottomSheet`, `SingleChoiceSegmentedButtonRow`, `DatePicker`,
  `Switch`, `Slider`, `ListItem`, `Surface`, and no `Stepper`.
- `RNHostView` hosts RN children inside SwiftUI, including inside a sheet or popover;
  `matchContents` is fixed at mount.

## Appendix B: audit of the current code (for orientation, verify before relying on a line)

- Headers: `src/ui/Screen.tsx:201-256` (`DetailScreen` options), `:466-494` (`BarAction`),
  `:252` (`headerLeft` override). Tab screens use `CollapsibleHeader` at `app/(tabs)/index.tsx:212`,
  `activities.tsx:262`, `exercises.tsx:265`, `workout.tsx:157`, `profile.tsx:130`.
  Own bars: `app/dev.tsx:250`, `app/workout/session.tsx:409`, `app/exercise/add.tsx:176`.
- Expo UI today: only `SegmentedControlNative` in `src/ui/controls.tsx:74-113`.
- Gutter values in use: `screenGutter` in most screens; `spacing.xl` (same number) in
  `app/exercise/[id].tsx`, `app/exercise/add.tsx`, `src/ui/rows.tsx`, `src/ui/Sheet.tsx`,
  `src/ui/states.tsx`; 26 pt in `app/+not-found.tsx:98`, `src/ui/states.tsx:186`; a negative
  margin trick in `app/activity/[id].tsx:1131`.
- Concatenated metadata: `src/ui/routineItems.tsx:363-366`, `app/(tabs)/exercises.tsx:537-547`,
  `app/(tabs)/workout.tsx:598-606`, `src/domain/display.ts:60-64`, `joinMiddleDot` in
  `src/utils/format.ts:373`.
- Existing primitives: `Chip` `src/ui/controls.tsx:248`, `Badge` and `Card` in
  `src/ui/layout.tsx`, ad-hoc `tagStyle` in `src/ui/routineItems.tsx:377`.
- Motion library: `src/ui/animation.ts` (springs, `usePressScale`, `useEntrance`,
  `useRollingValue`, reduced motion honoured). Keep what content still uses, delete the header
  collapse and sheet drag hooks.
- FlashList already used by the five tab lists, `app/workout/history.tsx`,
  `src/ui/exercisePicker.tsx`, `src/ui/routineItems.tsx`.
