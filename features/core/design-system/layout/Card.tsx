import { memo, type ReactNode } from 'react';
import { type GestureResponderEvent, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import type { SpacingStep } from '@/features/core/design-system/layout/flex';
import { spacing, type Theme, useAppTheme } from '@/features/core/theme';

/**
 * The card. `tone` is the only intentional surface variation: `sunken` reads as
 * a value inside a container, `accent` as something the user should act on.
 * Shadows are declared for both platforms (elevation on Android) because the
 * alternative: no depth on Android: makes the light theme look unfinished.
 */
export const Card = memo(function Card({
  children,
  onPress,
  tone = 'raised',
  padding = 'lg',
  style,
  onLongPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  tone?: CardTone;
  padding?: SpacingStep;
  style?: StyleProp<ViewStyle>;
  onLongPress?: (e: GestureResponderEvent) => void;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const surface = cardSurface(theme, tone);
  const interactive = Boolean(onPress || onLongPress);

  // NOTE: The platform skin decides radius, colour, hairline and depth: an inset-grouped card on
  // iOS, a Material tonal surface on Android. Screens never branch on this themselves.
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: surface.background,
      borderRadius: theme.surfaceSkin.radius,
      padding: spacing[padding],
      borderWidth: surface.border,
      borderColor: surface.borderColor,
      overflow: 'hidden',
    },
    tone === 'raised' && theme.surfaceSkin.shadow ? theme.shadows.card : null,
    style,
  ];

  if (!interactive) return <View style={base}>{children}</View>;

  // NOTE: Pressed feedback is a `Pressable` style function, so the scale happens on the
  // native prop path on press rather than by re-rendering the card's subtree.
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      {...(accessibilityLabel ? { accessibilityLabel } : null)}
      style={({ pressed }) => [base, pressed ? { opacity: 0.85, transform: [{ scale: 0.994 }] } : null]}
    >
      {children}
    </Pressable>
  );
});

type CardTone = 'flat' | 'raised' | 'sunken' | 'accent' | 'outline';

function cardSurface(theme: Theme, tone: CardTone): { background: string; border: number; borderColor: string } {
  switch (tone) {
    case 'flat':
      return { background: theme.colors[theme.surfaceSkin.surface], border: 0, borderColor: 'transparent' };
    case 'raised':
      return {
        background: theme.colors[theme.surfaceSkin.surface],
        border: theme.surfaceSkin.separator === 'hairline' ? 1 : 0,
        borderColor: theme.colors.hairline,
      };
    case 'sunken':
      // NOTE: The canvas colour is the *recessed* tone in both palettes: darker ink in
      // dark mode, warmer paper in light. It is a different token from
      // `background` precisely so the two can be tuned apart.
      return { background: theme.colors.canvas, border: 1, borderColor: theme.colors.hairline };
    case 'accent':
      return { background: theme.colors.accentSoft, border: 1, borderColor: theme.colors.accent };
    case 'outline':
      return { background: 'transparent', border: 1, borderColor: theme.colors.border };
  }
}
