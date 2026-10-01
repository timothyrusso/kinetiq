import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import type { SettingsRow, SettingsSection } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import type { ParseIssue } from '@/features/transfer/domain/entities/ParsedImport';
import type { ExportTarget, ImportSource } from '@/features/transfer/domain/entities/TransferFormat';
import { ImportTooLarge, ImportUnreadable } from '@/features/transfer/domain/errors/TransferErrors';
import { useCopyAiPrompt } from '@/features/transfer/facades/useCopyAiPrompt';
import { useExport } from '@/features/transfer/facades/useExport';
import { useReadImport } from '@/features/transfer/facades/useReadImport';

const UNREADABLE: ParseIssue = { key: 'dataTransfer.errorUnreadable' };
const TOO_LARGE: ParseIssue = { key: 'dataTransfer.errorTooLarge' };

/** The issue a failed read shows: the parser's own, or the reason the text could not be read. */
function issueOf(error: unknown): ParseIssue {
  if (error instanceof ImportUnreadable) return error.issue;
  if (error instanceof ImportTooLarge) return TOO_LARGE;
  return UNREADABLE;
}

/**
 * Your data: export history and routines, import routines and the AI recipe. Import is routines
 * only: importing a plan twice is harmless, importing history twice doubles every chart. The AI section is a recipe, not an integration: "Copy instructions" puts a
 * prompt describing the routines file on the clipboard, and any chat can write a file "Paste from
 * clipboard" reads back. Errors stay on the screen, as a row under the buttons that caused them.
 */
export function useDataPageLogic() {
  const { t } = useT();
  const router = useRouter();
  const { mutate: exportFile, isPending: exporting, isError: exportFailed } = useExport();
  const { mutate: read, isPending: reading, error: readError } = useReadImport();
  const { mutate: copy, isSuccess: copied } = useCopyAiPrompt();

  const runExport = useCallback(
    (target: ExportTarget) => exportFile(target, { onError: () => haptics.warning() }),
    [exportFile],
  );

  const readImport = useCallback(
    (source: ImportSource) => {
      read(source, {
        onSuccess: staged => {
          if (staged !== null) router.push(routes.importPreview());
        },
        onError: () => haptics.warning(),
      });
    },
    [read, router],
  );

  const copyPrompt = useCallback(
    () => copy(t('dataTransfer.aiPrompt'), { onSuccess: () => haptics.success() }),
    [copy, t],
  );

  const importIssue = readError === null ? null : issueOf(readError);

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
    if (exportFailed) exportRows.push({ kind: 'info', key: 'exportError', title: t('dataTransfer.exportFailed') });

    const importRows: SettingsRow[] = [
      {
        kind: 'button',
        key: 'paste',
        title: t('dataTransfer.pasteClipboard'),
        disabled: reading,
        onPress: () => readImport('clipboard'),
      },
      {
        kind: 'button',
        key: 'file',
        title: t('dataTransfer.chooseFile'),
        disabled: reading,
        onPress: () => readImport('file'),
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
            onPress: copyPrompt,
          },
        ],
      },
    ];
  }, [copied, copyPrompt, exportFailed, exporting, importIssue, readImport, reading, runExport, t]);

  return { derived: { title: t('dataTransfer.title'), sections } };
}
