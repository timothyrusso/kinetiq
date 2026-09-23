import type { SFSymbol } from 'sf-symbols-typescript';

import type { Theme } from '@/theme/theme';
import type { IconName } from '@/ui/icons';

/**
 * A whole screen that has nothing to show and says why: an unmatched route, a route that threw.
 *
 * SwiftUI's own `ContentUnavailableView` on iOS 17 and later, the Material empty-state layout
 * (tonal icon, headline, body, filled then outlined button) everywhere else. For a state INSIDE
 * a screen or a list, use `EmptyState` and `ErrorState` from `src/ui/states.tsx`: a native host
 * does not belong in a list.
 *
 * The theme is a prop, never read from the store, because the error boundary renders this when
 * the store itself may be what failed (see `RouteErrorScreen`).
 */
export type ContentUnavailableAction = {
  key: string;
  label: string;
  onPress: () => void;
  /** The one action the screen is for: filled on Android, prominent on iOS. */
  prominent?: boolean;
};

export type ContentUnavailableProps = {
  theme: Theme;
  title: string;
  description?: string;
  /** The glyph on iOS. */
  systemImage: SFSymbol;
  /** The glyph everywhere else (Ionicons, drawn in React Native). */
  icon: IconName;
  /** `danger` tints the Material icon for a failure; iOS draws the symbol in its own grey. */
  tone?: 'neutral' | 'danger';
  /** Monospaced and selectable, for the fact a bug report needs: a path, an error message. */
  detail?: string;
  /** A fainter second block under `detail`: a stack trace. */
  trace?: string;
  actions: readonly ContentUnavailableAction[];
  /**
   * Lesser destinations. iOS gathers them into one menu button titled `linksLabel`; Material
   * lays them out as a row of text buttons.
   */
  links?: readonly { key: string; label: string; onPress: () => void }[];
  linksLabel?: string;
};
