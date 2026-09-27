import { Effect } from 'effect';
import type { ParsedRoutine, ParseIssue } from '@/features/transfer/domain/entities/ParsedImport';
import type { ImportSource } from '@/features/transfer/domain/entities/TransferFormat';
import { ImportTooLarge, ImportUnreadable } from '@/features/transfer/domain/errors/TransferErrors';
import { TransferDevice } from '@/features/transfer/domain/services/TransferDevice';
import { parseRoutines } from '@/features/transfer/domain/utils/parseRoutines';
import { IMPORT_RULES } from '@/features/transfer/useCases/importRules';

/** An import read and parsed, before any exercise is looked up. */
interface ReadImport {
  readonly routines: readonly ParsedRoutine[];
  readonly issues: readonly ParseIssue[];
}

/**
 * Reads a routines file from the clipboard or a picked file and parses it. Succeeds with `null`
 * when the user backed out of the picker. Fails with `ImportTooLarge` for a file or text past the
 * size limit, and with `ImportUnreadable`, carrying the issue the screen shows, for anything that
 * is not a routines file with exercises or that could not be read at all.
 */
export const readImport = (source: ImportSource) =>
  Effect.gen(function* () {
    const device = yield* TransferDevice;
    const raw = yield* (
      source === 'clipboard' ? device.readClipboard : device.pickFile(IMPORT_RULES.limits.bytes)
    ).pipe(
      Effect.catchTag('UnexpectedError', cause =>
        Effect.fail(new ImportUnreadable({ issue: { key: 'dataTransfer.errorUnreadable' }, cause })),
      ),
    );
    if (raw === null) return null;
    const parsed = parseRoutines(raw, IMPORT_RULES);
    if (!parsed.ok) {
      return yield* parsed.issue.key === 'dataTransfer.errorTooLarge'
        ? new ImportTooLarge()
        : new ImportUnreadable({ issue: parsed.issue });
    }
    const read: ReadImport = { routines: parsed.routines, issues: parsed.issues };
    return read;
  });
