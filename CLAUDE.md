# Kinetiq

React Native fitness tracker. Expo SDK 57, expo-router, TanStack Query, SQLite, TypeScript strict.

## Typography

Never use an em dash (U+2014) anywhere: not in user-facing copy, not in translations, not in
code comments, not in seed data, not in commit messages. Use a colon, a comma, parentheses, or
a middle dot (`·`) where a separator is genuinely wanted. `npm run check` enforces this.

The same applies to the en dash (U+2013) in prose. A hyphen is fine, and a numeric range
(`8-12` reps) should use a plain hyphen.

## Icons

Three sources, and no fourth:

1. SF Symbols (`sf`) and Material Symbols (`md`) where an Expo UI or expo-router API takes them:
   the tab bar, `Stack.Toolbar`, native buttons and lists.
2. MaterialIcons from `@expo/vector-icons`, rendered to an image, for Android surfaces that only
   take an image source (header items, Compose icons). `src/ui/materialIcons.ts` renders them
   once at bootstrap.
3. Ionicons, via `@expo/vector-icons`, for every icon drawn in React Native content.

Header icons are named in one table, `src/navigation/headerActions.ts`: an `sf` and a
`material` name per action. Do not hand-author SVG glyph paths. If no source has a needed icon,
ask rather than drawing one.

## Native components

Both platforms must feel native. Where Expo UI has a control on one platform only, the other
platform gets a fallback that follows its own conventions (HIG on iOS, Material 3 on Android);
never ship one platform's look on the other.

Controls live in `src/ui/controls/<Name>/`. Import from `@expo/ui` (the universal API) first;
if the control is missing there, use `@expo/ui/swift-ui` in `index.ios.tsx` and
`@expo/ui/jetpack-compose` in `index.android.tsx`, with a shared `types.ts`. A platform with
nothing gets the React Native fallback in its own file. Callers import `@/ui/controls/Name` and
never see the branch. `Platform.select` is for single values (a number, a colour), never for UI
structure.

`RNHostView` can host React Native inside Expo UI, but not in list rows or anything that
scrolls: its size is fixed at mount and each host is a native view boundary. Confirms are
`ConfirmDialog`, editors are form-sheet routes, settings screens are `SettingsList`.

Where neither platform has a control, build a small component in `src/ui/` modelled on the
react-native-reusables patterns. Do not add a component library.

## Layout

One source of truth per measurement. Spacing comes from `spacing` in `src/theme/tokens.ts`,
bottom insets from `src/ui/insets.ts`, type from the `VARIANTS` table in `src/ui/Text.tsx`,
the grouped-surface skin from `platformSurface`. A screen that hard-codes a number another
screen also needs is a bug waiting to diverge, and this codebase has already paid for it twice:
fifteen conflicting `BOTTOM_SPACE` constants, and two header components with different
vertical-centring maths.

`screenGutter` is the only horizontal edge token; `spacing.xl` is never a gutter. `npm run
check` fails on a literal or `spacing.xl` horizontal padding or margin in `app/` and
`src/ui/` (chart internals are allowlisted in `scripts/check-layout.allow`).

Metadata is never a joined string: rows and cards take `meta` and `tags` and draw them with
`MetaLine`, `TagRow`, `StatTile` and `Badge` (`src/ui/display/`). `joinMiddleDot` is for
accessibility labels only.

The header is always the navigator's own (`ScreenHeader` sets the per-screen options). Only the
live workout and a running recording hide it.

## Performance

Every list is a `FlashList` with a stable `keyExtractor`, `getItemType` where rows differ, and
a measured `estimatedItemSize`. Rows are `memo`ised, take primitive or stable props and the
theme as a prop, and get callbacks that take the id; nothing in `renderItem` creates an object
or a closure per row. No Expo UI host inside a list row. Images go through `expo-image` with a
`recyclingKey`. Motion is Reanimated on the UI thread: no `setState` per frame, no RN
`Animated`, no `LayoutAnimation`. Sorting, grouping and formatting happen in `useMemo` or the
query layer, never in render.

## Internationalisation

All user-facing copy, including accessibility labels, goes through the catalog in
`src/i18n/`. English and Italian are both required; a key present in one and missing from the
other fails `npm run check`.

Components read it with `useT()`. Code that cannot call a hook (a service, a module-level
table, a plain helper) uses `tr()` from `src/i18n/tr.ts`, which reads the language from the
settings store at call time. A module-level map of labels holds catalog KEYS, never words: it
is built at import time, when there is no language yet.

Two deliberate exceptions: `app/dev.tsx` (the fault-injection console, which ships only in
`__DEV__` and whose copy the QA scripts match on), and the product name.

## Gates

`npm run check` before any commit. The device gates (`qa:crud`, `qa:network`, `qa:pagination`,
`qa:offline`, `qa:faults`) need Metro on port 8083 and the iPhone 17 Pro simulator; port 8081
belongs to a different project on this machine and must not be used.

Assertions read from the database (`dbQuery`) rather than from the screen wherever the claim is
about persistence. A row filtered out of a list and a deleted row look identical in pixels.
