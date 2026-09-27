import type { Theme } from '@/features/core/theme';
import { useAppTheme } from '@/features/core/theme';

/** What a view's `Name.style.ts` exports: `createStyles(theme)`, returning a `StyleSheet`. */
export type StyleFactory<T> = (theme: Theme) => T;

const cache = new WeakMap<StyleFactory<unknown>, WeakMap<Theme, unknown>>();

/** The styles `createStyles` builds for `theme`, built once per factory and theme object. */
export function stylesFor<T>(createStyles: StyleFactory<T>, theme: Theme): T {
  let byTheme = cache.get(createStyles);
  if (byTheme === undefined) {
    byTheme = new WeakMap();
    cache.set(createStyles, byTheme);
  }
  if (!byTheme.has(theme)) byTheme.set(theme, createStyles(theme));
  return byTheme.get(theme) as T;
}

/**
 * The styles a view's `createStyles(theme)` builds for the current theme. Memoised per factory
 * and theme object, so every render gets the same style object until the theme changes:
 *
 * ```ts
 * // ItemRow.style.ts
 * export const createStyles = (theme: Theme) =>
 *   StyleSheet.create({ row: { paddingHorizontal: screenGutter, backgroundColor: theme.colors.surface } });
 *
 * // ItemRow.tsx
 * const styles = useStyles(createStyles);
 * ```
 */
export function useStyles<T>(createStyles: StyleFactory<T>): T {
  return stylesFor(createStyles, useAppTheme());
}
