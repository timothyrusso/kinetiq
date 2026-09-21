# Kinetiq

React Native fitness tracker. Expo SDK 57, expo-router, TanStack Query, SQLite, TypeScript strict.

## Typography

Never use an em dash (U+2014) anywhere: not in user-facing copy, not in translations, not in
code comments, not in seed data, not in commit messages. Use a colon, a comma, parentheses, or
a middle dot (`·`) where a separator is genuinely wanted. `npm run check` enforces this.

The same applies to the en dash (U+2013) in prose. A hyphen is fine, and a numeric range
(`8-12` reps) should use a plain hyphen.

## Icons

Two sources, and no third:

1. SF Symbols (`sf`) and Material Symbols (`md`) inside Expo UI components, where the API takes
   them. This is the tab bar today.
2. Ionicons, via `@expo/vector-icons`, for every other icon in the app.

Do not hand-author SVG glyph paths. If neither source has a needed icon, ask rather than
drawing one.

## Native components

Prefer Expo UI (`@expo/ui`) for leaf controls: button, switch, slider, stepper, segmented
control, picker, sheet. Its components are SwiftUI/Compose islands hosted through `Host` and
cannot contain React Native children, so they suit self-contained controls and not containers.

Where Expo UI has no equivalent, build a small component in `src/ui/` modelled on the
react-native-reusables patterns. Do not add a component library.

## Layout

One source of truth per measurement. Spacing comes from `spacing` in `src/theme/tokens.ts`,
bottom insets from `src/ui/insets.ts`, type from the `VARIANTS` table in `src/ui/Text.tsx`.
A screen that hard-codes a number another screen also needs is a bug waiting to diverge, and
this codebase has already paid for it twice: fifteen conflicting `BOTTOM_SPACE` constants, and
two header components with different vertical-centring maths.

## Internationalisation

All user-facing copy, including accessibility labels, goes through the catalog in
`src/i18n/`. English and Italian are both required; a key present in one and missing from the
other fails `npm run check`.

## Gates

`npm run check` before any commit. The device gates (`qa:crud`, `qa:network`, `qa:pagination`,
`qa:offline`, `qa:faults`) need Metro on port 8083 and the iPhone 17 Pro simulator; port 8081
belongs to a different project on this machine and must not be used.

Assertions read from the database (`dbQuery`) rather than from the screen wherever the claim is
about persistence. A row filtered out of a list and a deleted row look identical in pixels.
