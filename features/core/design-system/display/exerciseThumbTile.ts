import type { Theme } from '@/features/core/theme';

/**
 * The colour of an exercise thumbnail's tile. Art sits on the light illustration tile in both
 * modes, so a photo's white margin reads as the tile rather than as a hole in a dark list. The
 * initials that stand in for missing art sit on the ordinary placeholder, like any other absence.
 */
export function exerciseThumbTile(theme: Theme, showsArt: boolean): string {
  return showsArt ? theme.colors.illustration : theme.colors.placeholder;
}

/**
 * What a full-size photo is drawn on. In dark mode that is the light illustration tile, for the
 * same white margins; in light mode the page itself is already paper, so the photo keeps sitting
 * on the page.
 */
export function illustrationBackdrop(theme: Theme): string {
  return theme.mode === 'dark' ? theme.colors.illustration : theme.colors.background;
}
