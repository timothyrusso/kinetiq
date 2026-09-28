import type { Theme } from '@/features/core/theme';

/**
 * The colour of an exercise thumbnail's tile. Art sits on the light illustration tile in both modes,
 * because a transparent wger drawing takes whatever is behind it and its lines are black. The
 * initials that stand in for missing art sit on the ordinary placeholder, like any other absence.
 */
export function exerciseThumbTile(theme: Theme, showsArt: boolean): string {
  return showsArt ? theme.colors.illustration : theme.colors.placeholder;
}
