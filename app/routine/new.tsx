/**
 * Building a new routine.
 *
 * A modal, because it has no history underneath it and it ends by `replace`ing itself with
 * the routine it created.
 *
 * ## The one save, and why not several
 *
 * The name and notes are ordinary controlled inputs; nothing is written until Done. The
 * alternative: autosaving the name on blur the way the saved-routine screen autosaves a
 * stepper press: would create a routine row the moment someone typed three characters and
 * then backed out. `routineRepository.save` has no "empty draft" concept and should not
 * acquire one: a routine with no exercises is not a thing this app displays, and inventing a
 * hidden state for it would leak into the routines list, the counts and the workout picker.
 *
 * The cost of one save is that a crash mid-build loses the build. That is accepted knowingly
 * (see `draftStore` for why even process death is treated as a cancel here), and it is the
 * reason the discard prompt exists rather than a resume-draft feature.
 *
 * ## Adding exercises is a sheet over this screen, not a navigation
 *
 * Pushing the library and coming back would lose the draft's context, and pushing
 * `app/exercise/add` would put a routine *picker* in front of someone who has already told
 * this screen which routine they are building. A sheet writes into the same store the screen
 * is rendering, so a new row is on screen the instant the sheet closes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/ui/Screen';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { MetaLine, type MetaItem } from '@/ui/display';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { usePreventRemove } from 'expo-router/react-navigation';
import { KeyboardAvoid } from '@/ui/layout';
import { TextInput } from '@/ui/controls/TextInput';
import { Card, Row, Stack as Column } from '@/ui/layout';
import { SectionHeader } from '@/ui/display';
import { Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { EmptyState } from '@/ui/states';
import { RoutineItemRow } from '@/ui/routineItems';
import { estimateMinutes, plannedVolumeKg } from '@/domain/logic';
import { useSaveRoutine } from '@/queries/useRoutines';
import { useSettings } from '@/settings';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { trimNumber, weightUnit, weightValue } from '@/utils/format';
import { haptics } from '@/services/haptics';
import { pairItems } from '@/routines/draft';
import { useT } from '@/i18n/useT';
import {
  clearDraft,
  draftToPayload,
  isDraftDirty,
  isDraftSavable,
  markDraftSaveFailed,
  markDraftSaved,
  markDraftSaving,
  moveDraftItem,
  openDraft,
  removeDraftItem,
  setDraftDescription,
  setDraftName,
  setDraftRestDefault,
  useRoutineDraft,
} from '@/routines/draftStore';

export default function NewRoutineScreen() {
  const { t } = useT();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const draft = useRoutineDraft();
  const units = useSettings((s) => s.unitSystem);
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const saveRoutine = useSaveRoutine();
  const navigation = useNavigation();

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  // Opened during the first render rather than in an effect, on purpose: `openDraft` always
  // resets, and doing it after the first paint would show whatever the last abandoned build
  // left behind for one frame before wiping it.
  useState(() => {
    openDraft({ defaultRestSeconds: defaultRest });
    return null;
  });

  // Keep the store's rest default in step with Settings, so a row added after the user
  // changed their default gets the new one and not the one read at mount. The store bails on
  // an equal value, so this cannot loop.
  useEffect(() => {
    setDraftRestDefault(defaultRest);
  }, [defaultRest]);

  const snapshotByExerciseId = useMemo(
    () => new Map(draft.snapshots.map((row) => [row.exerciseId, row])),
    [draft.snapshots],
  );
  const rows = useMemo(
    () => pairItems(draft.items, snapshotByExerciseId),
    [draft.items, snapshotByExerciseId],
  );

  const volumeKg = plannedVolumeKg(draft.items);
  const minutes = estimateMinutes(draft.items);

  const save = useCallback(async () => {
    if (!isDraftSavable()) {
      // An inline reason, not a permanently greyed-out primary button: a call-to-action that
      // cannot be pressed and says nothing about why is the most reliably confusing control
      // in a form.
      setBlocked(t('newRoutine.addOneFirst'));
      haptics.warning();
      return;
    }
    setBlocked(null);
    markDraftSaving();
    try {
      const saved = await saveRoutine.mutateAsync(draftToPayload());
      markDraftSaved();
      haptics.success();
      // `replace`, not `push`: this screen has now become the routine it describes. Leaving
      // the builder underneath it means "back" returns to a form whose entire contents have
      // been saved, which the user would then be invited to save again.
      router.replace(routes.routine(saved.id));
    } catch {
      markDraftSaveFailed();
      setBlocked(t('newRoutine.saveFailed'));
      haptics.warning();
    }
  }, [saveRoutine, t]);

  // Back gesture, hardware back, the swipe, Cancel and a dismiss all remove this screen, and
  // `usePreventRemove` intercepts every one of them. Without it, the same thumb that can lose
  // a workout by backgrounding the app can lose a routine by swiping. The blocked action is
  // kept so a confirmed discard can finish exactly the navigation the user started.
  const pendingRemoval = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  usePreventRemove(isDraftDirty(), ({ data }) => {
    pendingRemoval.current = data.action;
    setConfirmDiscard(true);
  });
  const cancel = useCallback(() => router.dismiss(), []);
  const done = useCallback(() => {
    void save();
  }, [save]);
  const summary = useMemo<MetaItem[]>(
    () =>
      draft.items.length === 0
        ? [{ icon: 'listAdd', label: t('newRoutine.subtitleEmpty') }]
        : [
            {
              icon: 'layers',
              label: `${draft.items.length} ${t('newRoutine.exerciseWord', { count: draft.items.length })}`,
            },
            { icon: 'clock', label: `~${minutes} min` },
          ],
    [draft.items.length, minutes, t],
  );

  return (
    <>
      <ScreenHeader title={t('newRoutine.title')} />
      <HeaderToolbar placement="left">
        {headerAction({ action: 'cancel', onPress: cancel, t })}
      </HeaderToolbar>
      <HeaderToolbar placement="right">
        {headerAction({
          action: 'done',
          onPress: done,
          t,
          label: draft.status === 'saving' ? 'newRoutine.saving' : 'newRoutine.done',
          disabled: draft.status === 'saving',
          variant: 'done',
          tint: theme.colors.accent,
        })}
      </HeaderToolbar>
      <KeyboardAvoid style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + spacing.huge,
            gap: spacing.xxl,
          }}
        >
          <Column gap="md" style={{ paddingHorizontal: screenGutter }}>
            <MetaLine items={summary} theme={theme} wrap />
            <TextInput
              label={t('newRoutine.nameLabel')}
              value={draft.name}
              onChangeText={setDraftName}
              placeholder={t('newRoutine.namePlaceholder')}
              hint={t(
                draft.name.trim().length === 0 && draft.items.length > 0
                  ? 'newRoutine.nameHintEmpty'
                  : 'newRoutine.nameHint',
              )}
              returnKeyType="next"
              accessibilityHint={t('newRoutine.nameA11y')}
            />
            <TextInput
              label={t('newRoutine.notesLabel')}
              value={draft.description}
              onChangeText={setDraftDescription}
              placeholder={t('newRoutine.notesPlaceholder')}
              multiline
              accessibilityHint={t('newRoutine.notesA11y')}
            />
          </Column>

          {rows.length === 0 ? (
            <EmptyState
              icon="listAdd"
              title={t('newRoutine.emptyTitle')}
              message={t('newRoutine.emptyMessage')}
              actionLabel={t('newRoutine.addExercise')}
              onAction={() => {
                haptics.light();
                router.push(routes.pickExercise('draft'));
              }}
            />
          ) : (
            <Column gap="md">
              <SectionHeader
                title={t('newRoutine.exercises')}
                eyebrow={`${rows.length} ${t('newRoutine.rowWord', { count: rows.length })}`}
                action={{ label: t('common.add'), onPress: () => {
                      haptics.light();
                      router.push(routes.pickExercise('draft'));
                    } }}
              />
              {/* No Card: `ListRow` carries its own horizontal padding and hairline, so a
                  bordered box around it would inset the dividers short of the edges. */}
              <View>
                {rows.map((row, index) => (
                  <RoutineItemRow
                    key={row.item.id}
                    item={row.item}
                    snapshot={row.snapshot}
                    units={units}
                    position={{
                      index,
                      count: rows.length,
                      onMove: (to) => moveDraftItem(index, to),
                    }}
                    onPress={() => router.push(routes.routineItem('draft', row.item.id))}
                    onLongPress={() => router.push(routes.routineItem('draft', row.item.id))}
                    onRemove={() => {
                      haptics.light();
                      removeDraftItem(row.item.id);
                    }}
                  />
                ))}
              </View>
              <Row gap="xxl" style={{ paddingHorizontal: screenGutter }}>
                <MetricNote
                  label={t('newRoutine.plannedVolume')}
                  value={
                    volumeKg === 0
                      ? t('newRoutine.bodyweight')
                      : `${trimNumber(weightValue(volumeKg, units), 0)} ${weightUnit(units)}`
                  }
                />
                <MetricNote label={t('newRoutine.estTime')} value={`~${minutes} min`} />
              </Row>
              <Txt variant="caption" tone="faint" style={{ paddingHorizontal: screenGutter }}>
                {t('newRoutine.reorderNote')}
              </Txt>
            </Column>
          )}

          {blocked === null ? null : (
            <Card tone="sunken" padding="md" style={{ marginHorizontal: spacing.lg }}>
              <Row gap="sm" align="start">
                <Icon name="warning" size={17} color={theme.colors.danger} />
                <Txt variant="body" style={{ flex: 1 }}>
                  {blocked}
                </Txt>
              </Row>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoid>

      {confirmDiscard ? (
        <ConfirmDialog
          visible
          title={t('newRoutine.discardTitle')}
          message={
            draft.items.length > 0
              ? t('newRoutine.discardWithItems', { count: draft.items.length })
              : t('newRoutine.discardEmpty')
          }
          confirmLabel={t('newRoutine.discard')}
          cancelLabel={t('common.cancel')}
          destructive
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            // The draft is cleared first so nothing is left to guard, then the navigation the
            // user started (a swipe, Cancel, a hardware back) is replayed as they asked for it.
            setConfirmDiscard(false);
            clearDraft();
            const action = pendingRemoval.current;
            pendingRemoval.current = null;
            if (action) navigation.dispatch(action);
            else router.dismiss();
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

function MetricNote({ label, value }: { label: string; value: string }) {
  return (
    <Column gap="xxs">
      <Txt variant="micro" tone="faint" uppercase tracking={0.6}>
        {label}
      </Txt>
      <Txt variant="strong">{value}</Txt>
    </Column>
  );
}
