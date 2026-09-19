/**
 * Bottom sheet chrome for expo-router `modal` routes.
 *
 * Why a component rather than a `Modal` with a `View` inside:
 *
 * - **Dismiss is a gesture, not a hint.** The drag runs natively (RNGH + Reanimated),
 *   so it stays smooth while the JS thread is busy — the common case, since sheets are
 *   usually opened over a screen that is still fetching.
 * - **The scrim fades with the drag**, so a released-early sheet looks half-dismissed
 *   rather than fully open with a finger-shaped hole in it.
 * - **Every close path funnels through one function.** Backdrop tap, drag, close
 *   button and the OS back gesture all reach the same `onRequestClose`, which is where
 *   an unsaved-changes guard lives. Screens confirm in that one place and nowhere else.
 * - **Height is content-driven with a ceiling.** A sheet that always fills the screen
 *   is a page; one that measures exactly is cramped. This hugs content up to 88 % of
 *   the viewport and scrolls past it.
 */
import React, { forwardRef, memo, useImperativeHandle, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, spacing, touchTarget } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme';
import { haptics } from '@/services/haptics';
import { useSheetDrag } from './animation';
import { Button } from './Button';
import { Icon } from './icons';
import { Txt } from './Text';

export type SheetHandle = {
  /** Closes without consulting any guard — call after a save has already succeeded. */
  dismiss: () => void;
};

type SheetProps = {
  children: React.ReactNode;
  /** Every close attempt (drag, backdrop, close button) arrives here. */
  onRequestClose: () => void;
  title?: string;
  subtitle?: string;
  /** Right-aligned header accessory — a text button or a count, not an icon. */
  accessory?: React.ReactNode;
  /** Content taller than the ceiling scrolls. Turn off for a fixed two-row sheet. */
  scrollable?: boolean;
  /** Drag disabled while a form is dirty and a confirmation is required. */
  dismissible?: boolean;
  /** Media previews: no grabber, no top padding, art bleeds to the corners. */
  edgeToEdge?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Sheet = forwardRef<SheetHandle, SheetProps>(function Sheet(
  {
    children,
    onRequestClose,
    title,
    subtitle,
    accessory,
    scrollable = true,
    dismissible = true,
    edgeToEdge = false,
    style,
  },
  ref,
) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  // A gesture can finish and the backdrop can be tapped in the same frame; without a
  // latch the route pops twice and the user lands two screens back.
  const closing = useRef(false);
  const [contentHeight, setContentHeight] = useState(0);

  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    onRequestClose();
  };

  const drag = useSheetDrag({ onDismiss: requestClose, enabled: dismissible });
  useImperativeHandle(ref, () => ({ dismiss: () => drag.release(2000) }), [drag]);

  const body = (
    <View
      onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
      style={{ gap: spacing.xl }}
    >
      {title || subtitle || accessory ? (
        <SheetHeader
          {...(title === undefined ? {} : { title })}
          {...(subtitle === undefined ? {} : { subtitle })}
          {...(accessory === undefined ? {} : { accessory })}
          {...(dismissible ? { onClose: requestClose } : {})}
        />
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          requestClose();
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={ABSOLUTE_FILL}
      >
        <AnimatedScrim style={drag.backdropStyle} />
      </Pressable>

      <GestureDetector gesture={drag.gesture}>
        <Animated.View
          style={[
            {
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              paddingTop: edgeToEdge ? 0 : spacing.md,
              // The bottom inset belongs to the sheet, not the content: a save button
              // under the iOS home indicator is unreachable, not merely tight.
              paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xxl),
              paddingHorizontal: spacing.xl,
              maxHeight: '88%',
              ...theme.shadows.raised,
              elevation: 24,
            },
            drag.style,
            style,
          ]}
        >
          {edgeToEdge ? null : (
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 5,
                borderRadius: radius.pill,
                marginBottom: spacing.md,
                backgroundColor: theme.colors.borderStrong,
              }}
            />
          )}
          {scrollable ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              // A short sheet must not stretch its scroll view to the ceiling and leave
              // dead space under the footer; a tall one has to be able to scroll at all.
              contentContainerStyle={contentHeight > 0 ? undefined : GROW_TO_FILL}
            >
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

/** The scrim lives on the JS-side colour but the UI-thread opacity of the drag. */
function AnimatedScrim({ style }: { style: React.ComponentProps<typeof Animated.View>['style'] }) {
  return (
    <Animated.View
      style={[ABSOLUTE_FILL, { backgroundColor: palette.black }, style]}
    />
  );
}



export const SheetHeader = memo(function SheetHeader({
  title,
  subtitle,
  onClose,
  accessory,
}: {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  accessory?: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        // Two 44 pt targets tall: the minimum header a thumb can reliably hit, and
        // the first thing users miss on a small phone when it is smaller.
        minHeight: touchTarget,
      }}
    >
      {onClose ? (
        <Pressable
          onPress={() => {
            haptics.light();
            onClose();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceRaised,
            marginLeft: -4,
            marginTop: 2,
          }}
        >
          <Icon name="close" size={17} color={theme.colors.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, gap: 2, paddingTop: spacing.xs }}>
        {title ? (
          <Txt variant="title" numberOfLines={2}>
            {title}
          </Txt>
        ) : null}
        {subtitle ? (
          <Txt variant="caption" tone="muted">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {accessory}
    </View>
  );
});

/**
 * Footer row that stays put while the sheet body scrolls: a real footer in the sheet's
 * own column rather than `position: absolute`, so it can never be covered by content.
 */
export const SheetFooter = memo(function SheetFooter({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: spacing.md,
          paddingTop: spacing.lg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.hairline,
          backgroundColor: theme.colors.background,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
});

/** A titled group inside a sheet, e.g. "Muscles" above a wrap of chips. */
export const SheetSection = memo(function SheetSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Txt variant="micro" tone="faint" uppercase tracking={0.8} style={{ flex: 1 }}>
          {title}
        </Txt>
        {action}
      </View>
      {children}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.hairline }} />
    </View>
  );
});

/**
 * The one shared shape for "are you sure". Deleting a routine, discarding a workout and
 * clearing data all use it, so the destructive verb is always in the same place, always
 * red, and always requires a deliberate second tap.
 */
export const ConfirmSheet = memo(function ConfirmSheet({
  title,
  message,
  confirmLabel,
  onConfirm,
  onRequestClose,
  destructive = true,
  cancelLabel = 'Cancel',
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onRequestClose: () => void;
  destructive?: boolean;
  cancelLabel?: string;
}) {
  return (
    <Sheet onRequestClose={onRequestClose} scrollable={false}>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xs }}>
        <Txt variant="title">{title}</Txt>
        <Txt variant="body" tone="muted">
          {message}
        </Txt>
      </View>
      <SheetFooter>
        <Button
          label={cancelLabel}
          variant="quiet"
          onPress={onRequestClose}
          style={{ flex: 1 }}
        />
        <Button
          label={confirmLabel}
          variant={destructive ? 'danger' : 'primary'}
          onPress={onConfirm}
          weighty
          style={{ flex: 1 }}
        />
      </SheetFooter>
    </Sheet>
  );
});

/**
 * Single-choice picker: units, default rest, sort order. Radio semantics even though
 * the rows are custom, because a picker a screen reader cannot enumerate is not a
 * picker. Selecting closes the sheet — a second tap to dismiss is the kind of friction
 * that shows up in one-star reviews.
 */
export function OptionSheet<T extends string | number>({
  title,
  options,
  value,
  onSelect,
  onRequestClose,
}: {
  title: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onSelect: (next: T) => void;
  onRequestClose: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Sheet title={title} onRequestClose={onRequestClose}>
      <View style={{ gap: spacing.xs }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => {
                haptics.selection();
                onSelect(option.value);
                onRequestClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: touchTarget,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: selected ? theme.colors.accentSoft : 'transparent',
              }}
            >
              <View style={{ flex: 1, gap: 1 }}>
                <Txt variant="bodyLg" weight={selected ? 'bold' : 'semibold'}>
                  {option.label}
                </Txt>
                {option.hint ? (
                  <Txt variant="caption" tone="muted">
                    {option.hint}
                  </Txt>
                ) : null}
              </View>
              {selected ? (
                <Icon name="check" size={19} color={theme.colors.accent} strokeWidth={2.5} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const GROW_TO_FILL: ViewStyle = { flexGrow: 1 };

const ABSOLUTE_FILL: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
