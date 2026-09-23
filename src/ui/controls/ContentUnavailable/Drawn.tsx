/**
 * The Material 3 empty-state layout, in React Native: a tonal icon, a headline, a supporting
 * line, then the actions as a filled button over an outlined one. Android's only version, and
 * iOS's below 17, where SwiftUI has no `ContentUnavailableView`.
 *
 * Plain `Text` and `Pressable` rather than `Txt` and `Button`, because both of those read the
 * settings store for the theme, and the route error screen has to render when the store is the
 * thing that threw. Type still comes from the `Txt` scale through its token accessors. The
 * same goes for context: nothing here needs a provider to be mounted.
 *
 * It scrolls. Centred content in a fixed box clips on a small phone in landscape, and a screen
 * whose explanation cannot be read is a second failure stacked on the first.
 */
import { memo, useContext } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { haptics } from '@/services/haptics';
import type { Theme } from '@/theme/theme';
import { radius, screenGutter, spacing, touchTarget } from '@/theme/tokens';
import { Icon, ICON_SIZE } from '@/ui/icons';
import { screenContentBottom } from '@/ui/insets';
import { fontFamilyOf, fontSizeOf, lineHeightOf, type TxtVariant } from '@/ui/Text';
import type { ContentUnavailableAction, ContentUnavailableProps } from './types';

export function DrawnContentUnavailable({
  theme,
  title,
  description,
  icon,
  tone = 'neutral',
  detail,
  trace,
  actions,
  links,
}: ContentUnavailableProps) {
  // The context, not `useSafeAreaInsets`: the root layout's error boundary renders this in
  // place of the layout that mounts the provider, and the hook throws without one.
  const insets = useContext(SafeAreaInsetsContext);
  const bottom = screenContentBottom(insets?.bottom ?? 0);
  const tint = tone === 'danger' ? theme.colors.danger : theme.colors.accent;
  const tintSoft = tone === 'danger' ? theme.colors.dangerSoft : theme.colors.accentSoft;
  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
    >
      <View style={styles.block}>
        <View style={[styles.disc, { backgroundColor: tintSoft }]}>
          <Icon name={icon} size={ICON_SIZE.large} color={tint} />
        </View>
        <Text role="heading" style={[type('title'), styles.center, { color: theme.colors.text }]}>
          {title}
        </Text>
        {description ? (
          <Text style={[type('body'), styles.center, { color: theme.colors.textMuted }]}>{description}</Text>
        ) : null}
      </View>

      {detail ? (
        <View style={[styles.detail, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text selectable style={[type('monoSm'), { color: theme.colors.text }]}>
            {detail}
          </Text>
        </View>
      ) : null}
      {trace ? (
        <Text selectable numberOfLines={8} style={[type('monoSm'), { color: theme.colors.textFaint }]}>
          {trace}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {actions.map((action) => (
          <ActionButton key={action.key} action={action} theme={theme} />
        ))}
      </View>

      {links && links.length > 0 ? (
        <View style={styles.links}>
          {links.map((link) => (
            <Pressable
              key={link.key}
              onPress={link.onPress}
              accessibilityRole="link"
              android_ripple={{ color: theme.colors.accentSoft, borderless: false }}
              style={styles.link}
            >
              <Text style={[type('label'), { color: theme.colors.accent }]}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Material 3 filled (prominent) or outlined button, full width, in the app's accent. */
const ActionButton = memo(function ActionButton({
  action,
  theme,
}: {
  action: ContentUnavailableAction;
  theme: Theme;
}) {
  const filled = action.prominent === true;
  return (
    <Pressable
      onPress={() => {
        haptics.medium();
        action.onPress();
      }}
      accessibilityRole="button"
      android_ripple={{ color: filled ? theme.colors.onAccent : theme.colors.accentSoft }}
      style={[
        styles.button,
        filled
          ? { backgroundColor: theme.colors.accent }
          : { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: theme.colors.border },
      ]}
    >
      <Text style={[type('strong'), { color: filled ? theme.colors.onAccent : theme.colors.accent }]}>
        {action.label}
      </Text>
    </Pressable>
  );
});

function type(variant: TxtVariant): TextStyle {
  const size = fontSizeOf(variant);
  return { fontFamily: fontFamilyOf(variant), fontSize: size, lineHeight: Math.round(size * lineHeightOf(variant)) };
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.huge,
  },
  block: { alignItems: 'center', gap: spacing.md },
  center: { textAlign: 'center' },
  disc: {
    width: touchTarget + spacing.lg,
    height: touchTarget + spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  detail: { borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  button: {
    minHeight: touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    overflow: 'hidden',
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  link: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
