import { Context, type Effect } from 'effect';
import type { UnexpectedError } from '@/features/core/error';
import type { ExportFile } from '@/features/transfer/domain/entities/TransferFormat';
import type { ImportTooLarge } from '@/features/transfer/domain/errors/TransferErrors';

/** The device's side of an export and an import: the share sheet, the clipboard, the file picker. */
export class TransferDevice extends Context.Tag('transfer/TransferDevice')<
  TransferDevice,
  {
    /** Writes `file` to the cache directory and hands it to the share sheet. */
    readonly share: (file: ExportFile) => Effect.Effect<void, UnexpectedError>;
    readonly readClipboard: Effect.Effect<string, UnexpectedError>;
    readonly copyToClipboard: (text: string) => Effect.Effect<void, UnexpectedError>;
    /**
     * The picked file's text, or `null` when the user backed out. A file larger than `maxBytes`
     * fails with `ImportTooLarge` before it is read.
     */
    readonly pickFile: (maxBytes: number) => Effect.Effect<string | null, ImportTooLarge | UnexpectedError>;
  }
>() {}
