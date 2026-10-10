import { act, waitFor } from '@testing-library/react-native';
import type { SettingsRow, SettingsSection } from '@/features/core/design-system';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { formatWeight } from '@/features/core/utils';
import type { Routine } from '@/features/routines';
import { getSettings } from '@/features/settings';
import { importScreenLayer } from '@/features/transfer/di/__tests__/transferScreenLayers';
import type { ParsedItem, StagedImport } from '@/features/transfer/domain/entities/ParsedImport';
import { useStagedImportStore } from '@/features/transfer/state/stagedImportStore';
import { useImportPageLogic } from '@/features/transfer/ui/pages/ImportPage/ImportPage.logic';

const anItem = (overrides: Partial<ParsedItem> = {}): ParsedItem => ({
  exerciseId: 'ex:barbell-bench-press-medium-grip',
  exerciseName: 'Bench Press',
  trackingType: 'weightReps',
  sets: [10, 10, 8, 8].map(reps => ({ type: 'weightReps', reps, weightKg: 60, targetRpe: null })),
  restSeconds: 120,
  notes: null,
  ...overrides,
});

const aStagedImport = (overrides: Partial<StagedImport> = {}): StagedImport => ({
  id: 'imp_1',
  routines: [
    {
      name: 'Push Day',
      items: [
        anItem(),
        anItem({ exerciseId: null, exerciseName: 'Squat', restSeconds: null }),
        anItem({ exerciseId: null, exerciseName: 'Levitation' }),
      ],
    },
  ],
  issues: [],
  ...overrides,
});

beforeEach(() => {
  resetAllStores();
});

const renderPage = async (
  staged: StagedImport | null,
  saved: Routine[] = [],
  options: Parameters<typeof importScreenLayer>[1] = {},
) => {
  if (staged !== null) useStagedImportStore.getState().stage(staged);
  const rendered = await renderWithLayer(importScreenLayer(saved, options), useImportPageLogic, undefined);
  return {
    ...rendered,
    done: async () => {
      await rendered.unmount();
      await rendered.done();
    },
  };
};

const sectionOf = (sections: readonly SettingsSection[], key: string) => sections.find(section => section.key === key);
const rowOf = (sections: readonly SettingsSection[], section: string, key: string) =>
  sectionOf(sections, section)?.rows.find(row => row.key === key);
const press = (row: SettingsRow | undefined) => {
  if (row?.kind === 'button') row.onPress();
};
const matched = async (result: { current: ReturnType<typeof useImportPageLogic> }) =>
  waitFor(() => expect(rowOf(result.current.derived.sections, 'confirm', 'import')).toBeDefined());

describe('useImportPageLogic', () => {
  it('says there is nothing to import when nothing was staged', async () => {
    const { result, done } = await renderPage(null);

    expect(result.current.derived.sections).toEqual([
      { key: 'empty', rows: [{ kind: 'info', key: 'empty', title: tr('dataTransfer.nothingStaged') }] },
    ]);
    await done();
  });

  it('shows an item found on the device with its targets', async () => {
    const { result, done } = await renderPage(aStagedImport());
    await matched(result);

    expect(rowOf(result.current.derived.sections, 'routine-0', 'item-0-0')).toEqual({
      kind: 'info',
      key: 'item-0-0',
      title: 'Bench Press',
      subtitle: tr('dataTransfer.itemTargets', { weight: formatWeight(60, getSettings().unitSystem), rest: 120 }),
      value: tr('dataTransfer.setsReps', { sets: 4, reps: '8-10' }),
    });
    await done();
  });

  it('shows an item counted in reps alone with its reps and its rest, and no weight', async () => {
    const pullUp = anItem({
      trackingType: 'repsOnly',
      sets: [12, 10, 8].map(reps => ({ type: 'repsOnly', reps, targetRpe: null })),
    });
    const { result, done } = await renderPage(aStagedImport({ routines: [{ name: 'Pull', items: [pullUp] }] }));
    await matched(result);

    expect(rowOf(result.current.derived.sections, 'routine-0', 'item-0-0')).toMatchObject({
      subtitle: tr('dataTransfer.itemRest', { rest: 120 }),
      value: tr('dataTransfer.setsReps', { sets: 3, reps: '8-12' }),
    });
    await done();
  });

  it('shows a timed item with its time as minutes and seconds', async () => {
    const plank = (seconds: number[]) =>
      anItem({
        trackingType: 'duration',
        restSeconds: null,
        sets: seconds.map(durationSeconds => ({ type: 'duration', durationSeconds, targetRpe: null })),
      });
    const { result, done } = await renderPage(
      aStagedImport({ routines: [{ name: 'Core', items: [plank([45, 45]), plank([30, 90])] }] }),
    );
    await matched(result);

    const { sections } = result.current.derived;
    expect(rowOf(sections, 'routine-0', 'item-0-0')).toMatchObject({
      subtitle: tr('dataTransfer.itemRest', { rest: getSettings().defaultRestSeconds }),
      value: tr('dataTransfer.setsDuration', { sets: 2, duration: '0:45' }),
    });
    expect(rowOf(sections, 'routine-0', 'item-0-1')).toMatchObject({
      value: tr('dataTransfer.setsDuration', { sets: 2, duration: '0:30-1:30' }),
    });
    await done();
  });

  it('names the catalog exercise a loose name matched and the name it was asked for', async () => {
    const { result, done } = await renderPage(aStagedImport());
    await matched(result);

    expect(rowOf(result.current.derived.sections, 'routine-0', 'item-0-1')).toMatchObject({
      title: 'Squat, Back',
      subtitle: tr('dataTransfer.matchedFrom', { name: 'Squat' }),
    });
    await done();
  });

  it('says an item that matched nothing will be skipped, and counts it in the footer', async () => {
    const { result, done } = await renderPage(aStagedImport());
    await matched(result);

    expect(rowOf(result.current.derived.sections, 'routine-0', 'item-0-2')).toMatchObject({
      title: 'Levitation',
      subtitle: tr('dataTransfer.missingNotFound'),
    });
    expect(sectionOf(result.current.derived.sections, 'confirm')?.footer).toBe(
      tr('dataTransfer.missingSummary', { count: 1 }),
    );
    await done();
  });

  it('lists what the parser changed in the footer', async () => {
    const issue = { key: 'dataTransfer.issueDefaults', vars: { routine: 1, item: 2 } } as const;
    const { result, done } = await renderPage(aStagedImport({ issues: [issue] }));
    await matched(result);

    expect(sectionOf(result.current.derived.sections, 'confirm')?.footer).toBe(
      [tr(issue.key, issue.vars), tr('dataTransfer.missingSummary', { count: 1 })].join('\n'),
    );
    await done();
  });

  it('names an unnamed routine by its position', async () => {
    const { result, done } = await renderPage(aStagedImport({ routines: [{ name: null, items: [anItem()] }] }));
    await matched(result);

    expect(sectionOf(result.current.derived.sections, 'routine-0')?.title).toBe(
      tr('dataTransfer.untitledRoutine', { number: 1 }),
    );
    await done();
  });

  it('writes the matched items and goes back to the Workout tab', async () => {
    const saved: Routine[] = [];
    const { result, done } = await renderPage(aStagedImport(), saved);
    await matched(result);

    await act(async () => press(rowOf(result.current.derived.sections, 'confirm', 'import')));

    await waitFor(() => expect(routerFake.history).toEqual([{ verb: 'dismissTo', href: routes.workoutTab() }]));
    expect(saved.map(routine => [routine.name, routine.items.map(item => item.exerciseName)])).toEqual([
      ['Push Day', ['Bench Press', 'Squat, Back']],
    ]);
    await done();
  });

  it('gives an item with no rest the default rest', async () => {
    const saved: Routine[] = [];
    const { result, done } = await renderPage(aStagedImport(), saved);
    await matched(result);

    await act(async () => press(rowOf(result.current.derived.sections, 'confirm', 'import')));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.items[1]?.restSeconds).toBe(getSettings().defaultRestSeconds);
    await done();
  });

  it('says the save failed and stays on the preview', async () => {
    const { result, done } = await renderPage(aStagedImport(), [], { saveFails: true });
    await matched(result);

    await act(async () => press(rowOf(result.current.derived.sections, 'confirm', 'import')));

    await waitFor(() =>
      expect(sectionOf(result.current.derived.sections, 'confirm')?.footer).toContain(tr('dataTransfer.saveFailed')),
    );
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('disables Import when no item found an exercise', async () => {
    const staged = aStagedImport({
      routines: [{ name: 'Air', items: [anItem({ exerciseId: null, exerciseName: 'Levitation' })] }],
    });
    const { result, done } = await renderPage(staged);
    await matched(result);

    expect(rowOf(result.current.derived.sections, 'confirm', 'import')).toMatchObject({
      title: tr('dataTransfer.nothingToImport'),
      disabled: true,
    });
    await done();
  });

  it('offers a retry when the exercises could not be looked up', async () => {
    const { result, done } = await renderPage(aStagedImport(), [], { snapshotsFail: true });

    await waitFor(() => expect(rowOf(result.current.derived.sections, 'error', 'retry')).toBeDefined());
    expect(rowOf(result.current.derived.sections, 'error', 'error')?.title).toBe(tr('dataTransfer.matchFailed'));
    await done();
  });

  it('clears the staged import when the preview goes', async () => {
    const { result, done } = await renderPage(aStagedImport());
    await matched(result);

    await done();

    expect(useStagedImportStore.getState().staged).toBeNull();
  });
});
