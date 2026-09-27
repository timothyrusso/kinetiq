import { ScrollView, View } from 'react-native';
import {
  Card,
  Stack as Column,
  ConfirmDialog,
  EmptyState,
  ICON_SIZE,
  Icon,
  KeyboardAvoid,
  Row,
  ScreenHeader,
  SectionHeader,
  StatTile,
  TextInput,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import { HeaderToolbar, headerAction } from '@/features/core/navigation';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { compactNumber, weightUnit, weightValue } from '@/features/core/utils';
import { RoutineItemRow } from '@/features/routines/ui/components/RoutineItemRow/RoutineItemRow';
import { useNewRoutinePageLogic } from '@/features/routines/ui/pages/NewRoutinePage/NewRoutinePage.logic';
import { createStyles } from '@/features/routines/ui/pages/NewRoutinePage/NewRoutinePage.style';

/**
 * Building a new routine, as a modal: nothing underneath it, and it ends by opening the routine
 * it created. Adding an exercise opens the picker over it, which writes into the same draft, so a
 * new row is on screen the moment the picker closes.
 */
export function NewRoutinePage() {
  const { state, derived, effects } = useNewRoutinePageLogic();
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);
  const { draft, units } = state;
  const count = draft.items.length;

  return (
    <>
      <ScreenHeader title={t('newRoutine.title')} />
      <HeaderToolbar placement="left">{headerAction({ action: 'cancel', onPress: effects.cancel, t })}</HeaderToolbar>
      <HeaderToolbar placement="right">
        {headerAction({
          action: 'save',
          onPress: effects.save,
          t,
          label: derived.busy ? 'newRoutine.saving' : 'newRoutine.done',
          disabled: !derived.savable,
          variant: 'done',
          tint: theme.colors.accent,
        })}
      </HeaderToolbar>
      <KeyboardAvoid style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, derived.contentStyle]}>
          <Column gap="md" style={styles.gutter}>
            <TextInput
              label={t('newRoutine.nameLabel')}
              value={draft.name}
              onChangeText={effects.setName}
              placeholder={t('newRoutine.namePlaceholder')}
              returnKeyType="next"
              accessibilityHint={t('newRoutine.nameA11y')}
            />
          </Column>

          {count === 0 ? (
            <EmptyState
              icon="listAdd"
              title={t('newRoutine.emptyTitle')}
              actionLabel={t('newRoutine.addExercise')}
              onAction={effects.addExercise}
            />
          ) : (
            <Column gap="md">
              <SectionHeader
                style={styles.gutter}
                title={t('newRoutine.exercises')}
                eyebrow={`${count} ${t('newRoutine.rowWord', { count })}`}
                action={{ label: t('common.add'), onPress: effects.addExercise }}
              />
              <View>
                {draft.items.map((item, index) => (
                  <RoutineItemRow
                    key={item.id}
                    item={item}
                    snapshot={state.snapshotByExercise.get(item.exerciseId) ?? null}
                    units={units}
                    theme={theme}
                    index={index}
                    count={count}
                    onOpen={effects.openItem}
                    onMove={effects.moveItem}
                    onRemove={effects.dropItem}
                  />
                ))}
              </View>
              <View style={styles.stats}>
                {derived.volumeKg === 0 ? null : (
                  <StatTile
                    label={t('newRoutine.plannedVolume')}
                    value={compactNumber(weightValue(derived.volumeKg, units))}
                    unit={weightUnit(units)}
                  />
                )}
                <StatTile label={t('newRoutine.estTime')} value={`~${derived.minutes}`} unit="min" />
              </View>
            </Column>
          )}

          {state.blocked === null ? null : (
            <View style={styles.gutter}>
              <Card tone="sunken" padding="md">
                <Row gap="sm" align="start">
                  <Icon name="warning" size={ICON_SIZE.inline} color={theme.colors.danger} />
                  <Txt variant="body" style={styles.flex}>
                    {state.blocked}
                  </Txt>
                </Row>
              </Card>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoid>

      {state.confirmDiscard ? (
        <ConfirmDialog
          visible
          title={t('newRoutine.discardTitle')}
          message={count > 0 ? t('newRoutine.discardWithItems', { count }) : t('newRoutine.discardEmpty')}
          confirmLabel={t('newRoutine.discard')}
          cancelLabel={t('common.cancel')}
          destructive
          onCancel={effects.keepEditing}
          onConfirm={effects.discard}
        />
      ) : null}
    </>
  );
}
