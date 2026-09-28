import type { Theme } from '@/features/core/theme';

/**
 * The colour of an exercise thumbnail's tile. Art sits on the light illustration tile in both modes,
 * because a transparent wger drawing takes whatever is behind it and its lines are black. The
 * initials that stand in for missing art sit on the ordinary placeholder, like any other absence.
 */
export function exerciseThumbTile(theme: Theme, showsArt: boolean): string {
  return showsArt ? theme.colors.illustration : theme.colors.placeholder;
}

/**
 * What a full-size illustration is drawn on. In dark mode that is the light illustration tile,
 * for the same black line art; in light mode the page itself is already paper, so the art keeps
 * sitting on the page.
 */
export function illustrationBackdrop(theme: Theme): string {
  return theme.mode === 'dark' ? theme.colors.illustration : theme.colors.background;
}
