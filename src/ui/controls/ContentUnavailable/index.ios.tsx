/**
 * A screen with nothing to show, on iOS: SwiftUI's own `ContentUnavailableView`, the view
 * Mail and Photos use for an empty mailbox or a failed load, with the actions under it.
 *
 * Expo UI's version takes a title, a symbol and a description and nothing else (it has no
 * `actions` slot), so the buttons are siblings in the same host rather than inside the view.
 * They sit at the bottom, above the home indicator, which is where iOS puts the way out of a
 * state like this.
 *
 * iOS 16 has no `ContentUnavailableView`, and the native view then renders nothing at all, so
 * below 17 this is the drawn layout instead.
 */
import { Platform, StyleSheet } from 'react-native';
import { Button, ContentUnavailableView, Host, Menu, Text, VStack } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  multilineTextAlignment,
  padding,
  textSelection,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { haptics } from '@/services/haptics';
import { screenGutter, spacing } from '@/theme/tokens';
import { DrawnContentUnavailable } from './Drawn';
import type { ContentUnavailableProps } from './types';

export type { ContentUnavailableAction, ContentUnavailableProps } from './types';

const NATIVE = Number.parseInt(String(Platform.Version), 10) >= 17;

/** Wide enough to fill any phone; SwiftUI treats it as "as wide as offered". */
const FILL = 10_000;

const mono = font({ design: 'monospaced', textStyle: 'footnote' });

export function ContentUnavailable(props: ContentUnavailableProps) {
  if (!NATIVE) return <DrawnContentUnavailable {...props} />;
  const { theme, title, description, systemImage, detail, trace, actions, links, linksLabel } = props;
  return (
    <Host
      style={[styles.host, { backgroundColor: theme.colors.background }]}
      colorScheme={theme.mode}
      seedColor={theme.colors.accent}
    >
      <VStack spacing={spacing.md}>
        <ContentUnavailableView
          title={title}
          systemImage={systemImage}
          {...(description ? { description } : {})}
        />
        {detail ? (
          <Text
            modifiers={[
              mono,
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              multilineTextAlignment('center'),
              textSelection(true),
              padding({ horizontal: screenGutter }),
            ]}
          >
            {detail}
          </Text>
        ) : null}
        {trace ? (
          <Text
            modifiers={[
              font({ design: 'monospaced', textStyle: 'caption2' }),
              foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
              lineLimit(8),
              textSelection(true),
              padding({ horizontal: screenGutter }),
            ]}
          >
            {trace}
          </Text>
        ) : null}
        <VStack spacing={spacing.sm} modifiers={[padding({ horizontal: screenGutter, bottom: spacing.lg })]}>
          {actions.map((action) => (
            <Button
              key={action.key}
              onPress={() => {
                haptics.medium();
                action.onPress();
              }}
              modifiers={[
                buttonStyle(action.prominent ? 'borderedProminent' : 'bordered'),
                controlSize('large'),
                tint(theme.colors.accent),
              ]}
            >
              <Text modifiers={[frame({ maxWidth: FILL })]}>{action.label}</Text>
            </Button>
          ))}
          {links && links.length > 0 && linksLabel ? (
            <Menu label={linksLabel} systemImage="square.grid.2x2" modifiers={[tint(theme.colors.accent)]}>
              {links.map((link) => (
                <Button key={link.key} label={link.label} onPress={link.onPress} />
              ))}
            </Menu>
          ) : null}
        </VStack>
      </VStack>
    </Host>
  );
}

const styles = StyleSheet.create({ host: { flex: 1 } });
