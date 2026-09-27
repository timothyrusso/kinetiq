import { Effect, Layer } from 'effect';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { toAppError, type UnexpectedError } from '@/features/core/error';
import type { ExportKind } from '@/features/transfer/domain/entities/TransferFormat';
import { ImportTooLarge } from '@/features/transfer/domain/errors/TransferErrors';
import { TransferDevice } from '@/features/transfer/domain/services/TransferDevice';

const MIME: Record<ExportKind, { mimeType: string; UTI: string }> = {
  json: { mimeType: 'application/json', UTI: 'public.json' },
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
};

const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, UnexpectedError> =>
  Effect.tryPromise({ try: run, catch: cause => toAppError(cause) });

/**
 * The share sheet, the clipboard and the file picker. An export is written to the cache
 * directory, because the share sheet needs a real file to hand over and nothing about it is worth
 * keeping afterwards. The picker takes JSON and plain text: an AI's answer saved from a chat is
 * often a `.txt`.
 */
export const TransferDeviceLive = Layer.succeed(TransferDevice, {
  share: file =>
    attempt(async () => {
      const cached = new File(Paths.cache, file.name);
      if (cached.exists) cached.delete();
      cached.create();
      cached.write(file.content);
      await Sharing.shareAsync(cached.uri, MIME[file.kind]);
    }),
  readClipboard: attempt(() => Clipboard.getStringAsync()),
  copyToClipboard: text => attempt(() => Clipboard.setStringAsync(text)).pipe(Effect.asVoid),
  pickFile: maxBytes =>
    Effect.gen(function* () {
      const result = yield* attempt(() =>
        DocumentPicker.getDocumentAsync({
          type: ['application/json', 'text/*'],
          copyToCacheDirectory: true,
          multiple: false,
        }),
      );
      if (result.canceled) return null;
      const asset = result.assets[0];
      if (!asset) return null;
      if (typeof asset.size === 'number' && asset.size > maxBytes) return yield* new ImportTooLarge();
      return yield* attempt(() => new File(asset.uri).text());
    }),
});
