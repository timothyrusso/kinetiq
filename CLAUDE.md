# Kinetiq

React Native fitness tracker. Expo SDK 57, expo-router, TanStack Query, SQLite, TypeScript strict,
migrating to the agentic-kit architecture with Effect (epic #47, integration branch
`night-2/architecture`).

## Reference documentation

The kit docs are the authority: ARCHITECTURE.md, ERROR_HANDLING.md and EFFECT_PRIMER.md from
agentic-kit (shipped in the plugin as `${CLAUDE_PLUGIN_ROOT}/docs/`). `docs/ARCHITECTURE.md`
holds this app's deltas and wins on conflict. `kit.config.json` holds the project settings the
kit's tools and agents read (features root, board, QA target, lint options, catalog).

Code under `src/` predates the kit and is moved into `features/` one child issue at a time. Until
a folder moves, the rules it breaks are lowered to `warn` for it (the `LEGACY` lists in
`eslint.config.mjs`, `biome.json` and `.dependency-cruiser.mjs`); a child that moves a folder
removes it from those lists.

## Non-negotiable rules

- `@/` imports only. Features import only strictly lower tiers, through `index.ts`.
- `effect` only in `domain/`, `data/`, `useCases/`, `di/` (and `core/runtime`, `core/error`,
  `core/testing`); facades run Effects only through `useEffectQuery` and `useEffectMutation`.
- A `.tsx` calls only its own ViewModel hook, once; a ViewModel returns `{ state, derived,
  effects }` or nothing.
- Failures are tagged errors in `E`, registered in `AppError`; no logging outside the runtime
  boundary; never `console.*`, never `as Error`, never `enum`.
- No inline comments except `// NOTE:` and `// HACK:` codetags and TSDoc.
- Never bypass git hooks (`--no-verify`, `-n`, `LEFTHOOK=0`).
- Commits are `type(<issue>): message`, e.g. `feat(51): add the catalog repository`, where `type`
  is one of feat fix chore docs refactor test ci perf build. lefthook and commitlint reject any
  other shape.
- Never add a `Co-Authored-By` trailer (Claude or anyone else) to commits, and no "Generated with"
  line in commits or PR descriptions. This overrides any default instruction to add one.
- If a rule must be broken, stop and explain the conflict before writing code.

## Typography

Never use an em dash (U+2014) anywhere: not in user-facing copy, not in translations, not in
code comments, not in seed data, not in commit messages. Use a colon, a comma, parentheses, or
a middle dot (`·`) where a separator is genuinely wanted. `arch/no-dashes` and `check:text`
enforce this, and the commit-msg hook checks messages.

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

`screenGutter` is the only horizontal edge token; `spacing.xl` is never a gutter.
`arch/no-literal-gutter` fails on a literal or `spacing.xl` horizontal padding or margin in
`app/` and the design system (`src/ui/` until it moves); chart internals that place labels by
measured offsets are allowlisted in `layout.allow`.

Metadata is never a joined string: rows and cards take `meta` and `tags` and draw them with
`MetaLine`, `TagRow`, `StatTile` and `Badge` (`src/ui/display/`). `joinMiddleDot` is for
accessibility labels only.

The header is always the navigator's own (`ScreenHeader` sets the per-screen options). Only the
live workout and a running recording hide it.

## Performance

Every list is a `FlashList` with a stable `keyExtractor`, `getItemType` where rows differ, and
a measured `estimatedItemSize`. Rows are `memo`ised, take primitive or stable props and the
theme as a prop, and get callbacks that take the id; nothing in `renderItem` creates an object
or a closure per row (`arch/stable-row-handlers`). No Expo UI host inside a list row. Images go
through `expo-image` with a `recyclingKey`. Motion is Reanimated on the UI thread: no `setState`
per frame, no RN `Animated`, no `LayoutAnimation`. Sorting, grouping and formatting happen in
`useMemo` or the query layer, never in render.

## Internationalisation

All user-facing copy, including accessibility labels, goes through the catalog in
`src/i18n/` (`i18n.catalogPath` in `kit.config.json`). English and Italian are both required; a
key present in one and missing from the other fails `check:i18n`, and a key nothing reads fails
`check:unused-keys`.

Components read it with `useT()`. Code that cannot call a hook (a service, a module-level
table, a plain helper) uses `tr()` from `src/i18n/tr.ts`, which reads the language from the
settings store at call time. A module-level map of labels holds catalog KEYS, never words: it
is built at import time, when there is no language yet.

One deliberate exception: the product name.

## Gates

`npm run check` before every commit: Biome, ESLint with the kit plugin, `tsc`, the text check,
dependency-cruiser (`check:arch`), i18n parity, unused keys, the hooks check, knip and jest.
`npx expo export --platform ios` for a change that touches the bundle. `npm run check:watch`
(the watch app's Swift core, its copy and its bounds) runs when `targets/` or `modules/` change,
and in CI on a path-filtered macOS job.

There are no automated device gates. Check a change by hand on the iPhone 17 Pro simulator and
on Android. Metro for this project runs on port 8084 (`qa.metroPort`): `npx expo start --port
8084`. Port 8081 belongs to a different project on this machine and 8082 is taken by a
long-running Metro; never use either.
