/**
 * Your data: export history and routines, import routines.
 *
 * ## Why import is routines only
 *
 * A routine is a plan, and importing one twice is harmless: you get two plans and delete one.
 * A workout is history. Importing it twice doubles every chart and can mint a personal record
 * that was never lifted, so history only goes out.
 *
 * ## The AI section is a recipe, not an integration
 *
 * There is no model and no server in the app. "Copy instructions" puts a prompt describing the
 * routines file on the clipboard; any chat, on any device, can then write a file this screen
 * reads back through "Paste from clipboard". The same format is what "Export routines" writes,
 * so an AI can also be handed the current routines and asked to change them.
 *
 * ## Errors stay on the screen
 *
 * A file that is not a routines file is the user's to fix (usually by asking the AI again), so
 * the reason is shown as a row under the buttons that caused it rather than in a dialog that
 * has to be dismissed before they can try again.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/ui/Screen';
import { SettingsList, type SettingsRow, type SettingsSection } from '@/ui/controls/SettingsList';
import { routes } from '@/navigation/nav';
import { useExport, type ExportTarget } from '@/queries/useTransfer';
import { parseRoutines, type ParseIssue } from '@/transfer/parseRoutines';
import { copyToClipboard, ImportTooLargeError, pickImportFile, readClipboard } from '@/transfer/importSource';
import { stageImport } from '@/transfer/stagedImport';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';

export default function SettingsDataScreen() {
  const { t } = useT();
  const router = useRouter();
  const { mutate: exportFile, isPending: exporting, isError: exportFailed } = useExport();

  const [importIssue, setImportIssue] = useState<ParseIssue | null>(null);
  const [reading, setReading] = useState(false);
  const [copied, setCopied] = useState(false);

  const runExport = useCallback(
    (target: ExportTarget) => {
      exportFile(target, { onError: () => haptics.warning() });
    },
    [exportFile],
  );

  const readImport = useCallback(
    async (source: 'clipboard' | 'file') => {
      setImportIssue(null);
      setReading(true);
      try {
        const raw = source === 'clipboard' ? await readClipboard() : await pickImportFile();
        if (raw === null) return;
        const parsed = parseRoutines(raw);
        if (!parsed.ok) {
          haptics.warning();
          setImportIssue(parsed.issue);
          return;
        }
        stageImport(parsed.routines, parsed.issues);
        router.push(routes.importPreview());
      } catch (error) {
        haptics.warning();
        setImportIssue({
          key: error instanceof ImportTooLargeError ? 'dataTransfer.errorTooLarge' : 'dataTransfer.errorUnreadable',
        });
      } finally {
        setReading(false);
      }
    },
    [router],
  );

  const copyPrompt = useCallback(async () => {
    await copyToClipboard(t('dataTransfer.aiPrompt'));
    haptics.success();
    setCopied(true);
  }, [t]);

  const sections = useMemo<SettingsSection[]>(() => {
    const exportRows: SettingsRow[] = [
      {
        kind: 'button',
        key: 'workoutsJson',
        title: t('dataTransfer.exportWorkouts'),
        disabled: exporting,
        onPress: () => runExport('workoutsJson'),
      },
      {
        kind: 'button',
        key: 'setsCsv',
        title: t('dataTransfer.exportSets'),
        disabled: exporting,
        onPress: () => runExport('setsCsv'),
      },
      {
        kind: 'button',
        key: 'routinesJson',
        title: t('dataTransfer.exportRoutines'),
        disabled: exporting,
        onPress: () => runExport('routinesJson'),
      },
    ];
    if (exportFailed) {
      exportRows.push({ kind: 'info', key: 'exportError', title: t('dataTransfer.exportFailed') });
    }

    const importRows: SettingsRow[] = [
      {
        kind: 'button',
        key: 'paste',
        title: t('dataTransfer.pasteClipboard'),
        disabled: reading,
        onPress: () => void readImport('clipboard'),
      },
      {
        kind: 'button',
        key: 'file',
        title: t('dataTransfer.chooseFile'),
        disabled: reading,
        onPress: () => void readImport('file'),
      },
    ];
    if (importIssue) {
      importRows.push({
        kind: 'info',
        key: 'importError',
        title: t('dataTransfer.importFailed'),
        subtitle: t(importIssue.key, importIssue.vars),
      });
    }

    return [
      { key: 'export', title: t('dataTransfer.exportTitle'), footer: t('dataTransfer.exportFooter'), rows: exportRows },
      { key: 'import', title: t('dataTransfer.importTitle'), footer: t('dataTransfer.importFooter'), rows: importRows },
      {
        key: 'ai',
        title: t('dataTransfer.aiTitle'),
        footer: t('dataTransfer.aiFooter'),
        rows: [
          {
            kind: 'button',
            key: 'copyPrompt',
            title: copied ? t('dataTransfer.aiCopied') : t('dataTransfer.aiCopy'),
            onPress: () => void copyPrompt(),
          },
        ],
      },
    ];
  }, [copied, copyPrompt, exportFailed, exporting, importIssue, readImport, reading, runExport, t]);

  return (
    <>
      <ScreenHeader title={t('dataTransfer.title')} largeTitle />
      <SettingsList sections={sections} />
    </>
  );
}
