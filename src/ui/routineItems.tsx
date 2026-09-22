/**
 * The routine item row and its editor, shared by both routine screens.
 *
 * ## Extracted because two screens would otherwise diverge
 *
 * The builder and the routine screen show the same row, and the difference between them
 * is *actions*, not appearance: a draft can be moved and deleted in memory, a saved item
 * can be moved and deleted through a mutation. Those arrive as optional callbacks, so
 * each screen renders exactly the controls it can perform, and neither owns a private
 * copy of the typography, the thumbnail fallback or the metric rhythm. Two copies of
 * that drift within a week, and the drift is the kind nobody notices until both screens
 * are open on the same routine.
 *
 * ## Reordering is buttons, not a drag
 *
 * Considered and rejected: a drag-to-reorder row. Building one means a pan gesture that
 * does not steal the list's own vertical scroll, a translating row that must not fight
 * FlashList's recycling, and haptics at the right moment: every one of them a class of
 * bug that only surfaces on a device under a real thumb. `ListRow` already forwards
 * `onLongPress`, so the honest long-press menu is available with no gesture code at all.
 * Up/down controls are the same operation, reachable one-handed, work in a screen reader,
 * and cannot mis-fire during a scroll. If a drag earns its keep later it goes here, in
 * one place, and this paragraph is where that decision gets reversed.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ExerciseThumb, ListRow } from '@/ui/rows';
import { Icon, type IconName } from '@/ui/icons';
import { Row } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { Stepper } from '@/ui/controls';
import { Sheet, SheetFooter, SheetSection } from '@/ui/Sheet';
import { Button } from '@/ui/Button';
import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import { radius, spacing, touchTarget } from '@/theme/tokens';
import {
  formatWeight,
  repsFromRange,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
  type UnitSystem,
} from '@/utils/format';
import type { ExerciseSnapshot, RoutineItem } from '@/domain/types';
import type { ItemTarget } from '@/routines/draft';
import { useT } from '@/i18n/useT';
import { tr } from '@/i18n/tr';

/** A row's position, in the form the row needs to draw its move controls. */
export type ItemPosition = {
  index: number;
  /** Rows in the list, so the first and last row can disable the impossible move. */
  count: number;
  /** Called with the index this row should move to; the caller clamps and writes. */
  onMove: (to: number) => void;
};

export const RoutineItemRow = memo(function RoutineItemRow({
  item,
  snapshot,
  units,
  position,
  onPress,
  onLongPress,
  onRemove,
  topDivider = true,
}: {
  item: RoutineItem;
  snapshot: ExerciseSnapshot | null;
  units: UnitSystem;
  /** Present in an ordered list; absent means the row cannot be moved. */
  position?: ItemPosition;
  /** Opens the editor. Absent makes the row inert, which is right for a preview. */
  onPress?: () => void;
  onLongPress?: () => void;
  /** Replaces the chevron with a trash control. */
  onRemove?: () => void;
  topDivider?: boolean;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const index = position?.index ?? 0;
  const count = position?.count ?? 1;

  return (
    <View
      style={topDivider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline } : undefined}
    >
      <ListRow
        theme={theme}
        title={item.exerciseName}
        subtitle={itemSubtitle(item, snapshot, units)}
        {...(onPress === undefined ? {} : { onPress })}
        {...(onLongPress === undefined ? {} : { onLongPress })}
        {...(onPress === undefined ? {} : { accessibilityHint: t('itemEditor.editHint') })}
        leading={
          <ExerciseThumb
            uri={snapshot === null ? null : (snapshot.thumbnailUrl ?? snapshot.imageUrl)}
            name={item.exerciseName}
            size={44}
            theme={theme}
          />
        }
        trailing={
          <Row gap="xxs">
            {position ? (
              <>
                <RowButton
                  icon="chevronUp"
                  label={`Move ${item.exerciseName} up`}
                  disabled={index === 0}
                  onPress={() => position.onMove(index - 1)}
                />
                <RowButton
                  icon="chevronDown"
                  label={`Move ${item.exerciseName} down`}
                  disabled={index >= count - 1}
                  onPress={() => position.onMove(index + 1)}
                />
              </>
            ) : null}
            {onRemove ? (
              <RowButton
                icon="trash"
                label={`Remove ${item.exerciseName} from this routine`}
                tone="danger"
                onPress={onRemove}
              />
            ) : position ? null : (
              <Icon name="chevronRight" size={17} color={theme.colors.textFaint} />
            )}
          </Row>
        }
      />
    </View>
  );
});

/**
 * A quiet trailing control: a 44pt target, a 19pt glyph, no disc.
 *
 * `IconButton` draws a filled circle, and a row with two filled circles in it reads as a
 * toolbar rather than as one row with controls. Disabled rows keep the glyph and lose the
 * press, so the shape of the control never shifts when the ends of the list change.
 */
function RowButton({
  icon,
  label,
  onPress,
  disabled = false,
  tone = 'muted',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'muted' | 'danger';
}) {
  const theme = useAppTheme();
  const color = disabled
    ? theme.colors.textFaint
    : tone === 'danger'
      ? theme.colors.danger
      : theme.colors.textMuted;
  return (
    <Pressable
      onPress={() => {
        if (tone === 'danger') haptics.light();
        else haptics.selection();
        onPress();
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={({ pressed }) => [
        styles.rowButton,
        { opacity: pressed && !disabled ? 0.45 : disabled ? 0.4 : 1 },
      ]}
    >
      <Icon name={icon} size={19} color={color} />
    </Pressable>
  );
}

/**
 * Editing one exercise's targets.
 *
 * ## No OK button, because every press commits
 *
 * The steppers write through, so this sheet is a surface for adjusting rather than a form
 * to submit: closing it *is* committing. That is what makes it safe on the saved-routine
 * screen, where each press goes straight to SQLite: there is no half-entered state for a
 * backdrop tap or the back gesture to interrupt, and no "discard changes?" prompt to get
 * wrong. A text field for weight would need a Done key, a blur, and a rule for what "62."
 * means when the sheet closes mid-keystroke.
 *
 * ## Weight is entered in the user's unit and converted exactly once
 *
 * On the way out, in the `onChange` that writes. Converting on the way in as well: and
 * again on close: is how a units-aware form ends up with a field reading 135 while the
 * stepper is quietly stepping kilograms.
 */
export const ItemEditorSheet = memo(function ItemEditorSheet({
  item,
  snapshot,
  units,
  defaultRestSeconds,
  onChange,
  onRemove,
  onRequestClose,
}: {
  item: RoutineItem;
  snapshot: ExerciseSnapshot | null;
  units: UnitSystem;
  defaultRestSeconds: number;
  onChange: (patch: Partial<ItemTarget>) => void;
  onRemove?: () => void;
  onRequestClose: () => void;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const step = weightStep(units);
  const displayWeight = weightDisplayValue(item.weightKg, units, step);
  const restingAtDefault = item.restSeconds === defaultRestSeconds;

  return (
    <Sheet
      onRequestClose={onRequestClose}
      title={item.exerciseName}
      subtitle={sheetSubtitle(item, snapshot)}
    >
      <SheetSection title={t('itemEditor.sets')}>
        <Stepper
          label={t('itemEditor.sets')}
          value={item.sets}
          min={1}
          max={20}
          step={1}
          onChange={(sets) => onChange({ sets })}
        />
      </SheetSection>

      <SheetSection title={t('itemEditor.reps')}>
        <Stepper
          label={t('itemEditor.reps')}
          value={repsFromRange(item.reps)}
          min={1}
          max={100}
          step={1}
          suffix={t('itemEditor.repsSuffix')}
          onChange={(reps) => onChange({ reps: String(reps) })}
        />
        <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
          {t('itemEditor.rangesNote')}
        </Txt>
      </SheetSection>

      <SheetSection title={t('itemEditor.weightIn', { unit: weightUnit(units) })}>
        <Stepper
          label={t('itemEditor.weightPerSet', { unit: weightUnit(units) })}
          value={displayWeight}
          min={0}
          max={units === 'imperial' ? 1000 : 450}
          step={step}
          onChange={(next) => onChange({ weightKg: weightFromDisplayValue(next, units) })}
        />
        {item.weightKg === 0 ? (
          <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
            {t('itemEditor.bodyweightNote')}
          </Txt>
        ) : null}
      </SheetSection>

      <SheetSection title={t('itemEditor.restBetweenSets')}>
        <Stepper
          label={t('itemEditor.restBetweenSets')}
          value={item.restSeconds}
          min={0}
          max={600}
          step={15}
          suffix="s"
          onChange={(restSeconds) => onChange({ restSeconds })}
        />
        {item.restSeconds === 0 ? (
          <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
            {t('itemEditor.zeroRestNote')}
          </Txt>
        ) : restingAtDefault ? (
          <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
            {t('itemEditor.defaultRestNote')}
          </Txt>
        ) : null}
      </SheetSection>

      {snapshot !== null &&
      (snapshot.primaryMuscles.length > 0 ||
        snapshot.equipment.length > 0 ||
        snapshot.instructions !== null) ? (
        <SheetSection title={t('itemEditor.fromLibrary')}>
          <Row gap="sm" wrap>
            {snapshot.primaryMuscles.map((muscle) => (
              <Row key={muscle} gap="xs" style={tagStyle(theme.colors)}>
                <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
                <Txt variant="micro">{muscle}</Txt>
              </Row>
            ))}
            {snapshot.equipment.map((gear) => (
              <Row key={gear} gap="xs" style={tagStyle(theme.colors)}>
                <Icon name="dumbbell" size={11} color={theme.colors.textMuted} />
                <Txt variant="micro" tone="muted">
                  {gear}
                </Txt>
              </Row>
            ))}
          </Row>
          {snapshot.instructions !== null ? (
            <Txt variant="caption" tone="muted">
              {snapshot.instructions}
            </Txt>
          ) : null}
        </SheetSection>
      ) : null}

      <SheetFooter>
        {onRemove === undefined ? null : (
          <Button
            label={t('itemEditor.remove')}
            variant="danger"
            icon="trash"
            onPress={onRemove}
          />
        )}
        <Button
          label={t('itemEditor.done')}
          onPress={onRequestClose}
          weighty
          style={{ flex: 1 }}
        />
      </SheetFooter>
    </Sheet>
  );
});

/* ------------------------------------------------------------------ helpers -- */

/**
 * The row's second line.
 *
 * Weight is the only number here the unit setting changes, so it is the only one
 * formatted; reps and sets are unit-free. A missing snapshot costs the muscle name and
 * nothing else: which is exactly why the exercise name is stored on the item.
 */
export function itemSubtitle(
  item: RoutineItem,
  snapshot: ExerciseSnapshot | null,
  units: UnitSystem,
): string {
  const load = item.weightKg === 0 ? tr('itemEditor.bodyweightShort') : formatWeight(item.weightKg, units);
  const targets = `${item.sets} × ${item.reps} · ${load}`;
  const muscle = snapshot?.primaryMuscles[0];
  return muscle ? `${targets} · ${muscle}` : targets;
}

function sheetSubtitle(item: RoutineItem, snapshot: ExerciseSnapshot | null): string {
  const parts = [`${item.sets} × ${item.reps}`];
  if (snapshot?.category) parts.push(snapshot.category);
  return parts.join(' · ');
}

type Colors = ReturnType<typeof useAppTheme>['colors'];

function tagStyle(colors: Colors): ViewStyle {
  return {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfacePressed,
    alignItems: 'center',
  };
}

const styles = StyleSheet.create({
  rowButton: {
    width: touchTarget * 0.8,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
} satisfies Record<string, ViewStyle>);
