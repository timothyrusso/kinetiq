import { readFileSync } from 'node:fs';
import { act, waitFor } from '@testing-library/react-native';
import type { SettingsRow, SettingsSection } from '@/features/core/design-system';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { makeDataScreenLayer } from '@/features/transfer/di/__tests__/transferScreenLayers';
import { useStagedImportStore } from '@/features/transfer/state/stagedImportStore';
import { useDataPageLogic } from '@/features/transfer/ui/pages/DataPage/DataPage.logic';

const exported = readFileSync(`${__dirname}/../../../../__fixtures__/kinetiq-routines.json`, 'utf8');

const { layer, device, reset } = makeDataScreenLayer();

beforeEach(() => {
  resetAllStores();
  reset();
});

const renderPage = async () => {
  const rendered = await renderWithLayer(layer(), useDataPageLogic, undefined);
  return {
    ...rendered,
    done: async () => {
      await rendered.unmount();
      await rendered.done();
    },
  };
};

const rowOf = (sections: readonly SettingsSection[], section: string, key: string) =>
  sections.find(candidate => candidate.key === section)?.rows.find(row => row.key === key);
const press = (row: SettingsRow | undefined) => {
  if (row?.kind === 'button') row.onPress();
};

describe('useDataPageLogic export', () => {
  it('hands the workouts file to the share sheet', async () => {
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'export', 'workoutsJson')));

    await waitFor(() => expect(device.shared.map(file => file.kind)).toEqual(['json']));
    expect(device.shared[0]?.name).toMatch(/workouts/);
    await done();
  });

  it('hands the sets file to the share sheet as CSV', async () => {
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'export', 'setsCsv')));

    await waitFor(() => expect(device.shared.map(file => file.kind)).toEqual(['csv']));
    await done();
  });

  it('says so under the buttons when the share sheet refuses the file', async () => {
    device.refuseShare = true;
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'export', 'routinesJson')));

    await waitFor(() =>
      expect(rowOf(result.current.derived.sections, 'export', 'exportError')?.title).toBe(
        tr('dataTransfer.exportFailed'),
      ),
    );
    expect(device.shared).toEqual([]);
    await done();
  });
});

describe('useDataPageLogic import', () => {
  it('stages a pasted routines file and opens the preview', async () => {
    device.clipboard = exported;
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'import', 'paste')));

    await waitFor(() => expect(routerFake.history).toEqual([{ verb: 'push', href: routes.importPreview() }]));
    expect(useStagedImportStore.getState().staged?.routines).toHaveLength(2);
    await done();
  });

  it('shows why pasted text is not a routines file and stages nothing', async () => {
    device.clipboard = 'Sure! Here is your plan.';
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'import', 'paste')));

    await waitFor(() =>
      expect(rowOf(result.current.derived.sections, 'import', 'importError')).toMatchObject({
        title: tr('dataTransfer.importFailed'),
        subtitle: tr('dataTransfer.errorNotJson'),
      }),
    );
    expect(useStagedImportStore.getState().staged).toBeNull();
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('says a picked file is too large', async () => {
    device.pickedTooLarge = true;
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'import', 'file')));

    await waitFor(() =>
      expect(rowOf(result.current.derived.sections, 'import', 'importError')).toMatchObject({
        subtitle: tr('dataTransfer.errorTooLarge'),
      }),
    );
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('stays on the screen when the user backs out of the file picker', async () => {
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'import', 'file')));

    await waitFor(() =>
      expect(rowOf(result.current.derived.sections, 'import', 'file')).toMatchObject({ disabled: false }),
    );
    expect(rowOf(result.current.derived.sections, 'import', 'importError')).toBeUndefined();
    expect(routerFake.history).toEqual([]);
    await done();
  });
});

describe('useDataPageLogic AI recipe', () => {
  it('copies the prompt to the clipboard and says it did', async () => {
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'ai', 'copyPrompt')));

    await waitFor(() =>
      expect(rowOf(result.current.derived.sections, 'ai', 'copyPrompt')?.title).toBe(tr('dataTransfer.aiCopied')),
    );
    expect(device.clipboard).toBe(tr('dataTransfer.aiPrompt'));
    await done();
  });
});

describe('useDataPageLogic catalog', () => {
  it('shows no count before the catalog is installed', async () => {
    const { result, done } = await renderPage();

    await waitFor(() => expect(rowOf(result.current.derived.sections, 'catalog', 'catalogCount')).toBeDefined());
    expect(rowOf(result.current.derived.sections, 'catalog', 'catalogCount')).toMatchObject({ value: undefined });
    await done();
  });
});
