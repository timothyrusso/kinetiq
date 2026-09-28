import { readFileSync } from 'node:fs';
import { Effect } from 'effect';
import { itEffect } from '@/features/core/testing';
import { en } from '@/features/core/translations/catalog/en';
import { it as italian } from '@/features/core/translations/catalog/it';
import { TransferDeviceFake } from '@/features/transfer/useCases/__tests__/transferFakes';
import { readImport } from '@/features/transfer/useCases/readImport';

const fixture = (name: string) => readFileSync(`${__dirname}/../../__fixtures__/${name}`, 'utf8');
const parsedFixture = (name: string) => {
  const { routines, issues } = JSON.parse(fixture(name));
  return { routines, issues };
};

describe('readImport', () => {
  itEffect(
    'reads an exported routines file into the routines the app always read from it',
    Effect.gen(function* () {
      expect(yield* readImport('clipboard')).toEqual(parsedFixture('kinetiq-routines.parsed.json'));
    }),
    TransferDeviceFake({ clipboard: fixture('kinetiq-routines.json') }),
  );

  itEffect(
    "reads an AI's answer in a code fence, clamping, defaulting and reporting as the app always has",
    Effect.gen(function* () {
      expect(yield* readImport('clipboard')).toEqual(parsedFixture('ai-answer.parsed.json'));
    }),
    TransferDeviceFake({ clipboard: fixture('ai-answer.txt') }),
  );

  itEffect(
    'reads a picked file the same way as the clipboard',
    Effect.gen(function* () {
      expect(yield* readImport('file')).toEqual(parsedFixture('kinetiq-routines.parsed.json'));
    }),
    TransferDeviceFake({ picked: { text: fixture('kinetiq-routines.json') } }),
  );

  itEffect(
    'succeeds with nothing when the user backs out of the picker',
    Effect.gen(function* () {
      expect(yield* readImport('file')).toBeNull();
    }),
    TransferDeviceFake({ picked: { text: null } }),
  );

  itEffect(
    'fails with ImportTooLarge for a file past the size limit, without reading it',
    Effect.gen(function* () {
      const result = yield* Effect.either(readImport('file'));

      expect(result._tag === 'Left' && result.left._tag).toBe('ImportTooLarge');
    }),
    TransferDeviceFake({ picked: { text: '{}', bytes: 1_000_001 } }),
  );

  itEffect(
    'fails with ImportTooLarge for pasted text past the size limit',
    Effect.gen(function* () {
      const result = yield* Effect.either(readImport('clipboard'));

      expect(result._tag === 'Left' && result.left._tag).toBe('ImportTooLarge');
    }),
    TransferDeviceFake({ clipboard: ' '.repeat(1_000_001) }),
  );

  itEffect(
    'fails with ImportUnreadable saying the clipboard is empty',
    Effect.gen(function* () {
      const result = yield* Effect.either(readImport('clipboard'));

      expect(result._tag === 'Left' && result.left).toMatchObject({
        _tag: 'ImportUnreadable',
        issue: { key: 'dataTransfer.errorEmpty' },
      });
    }),
    TransferDeviceFake({ clipboard: '  ' }),
  );

  itEffect(
    'fails with ImportUnreadable saying it is not a routines file',
    Effect.gen(function* () {
      const result = yield* Effect.either(readImport('clipboard'));

      expect(result._tag === 'Left' && result.left).toMatchObject({
        _tag: 'ImportUnreadable',
        issue: { key: 'dataTransfer.errorNotJson' },
      });
    }),
    TransferDeviceFake({ clipboard: 'Sorry, I cannot help with that {' }),
  );

  itEffect(
    'fails with ImportUnreadable saying no routine has exercises',
    Effect.gen(function* () {
      const result = yield* Effect.either(readImport('clipboard'));

      expect(result._tag === 'Left' && result.left).toMatchObject({
        _tag: 'ImportUnreadable',
        issue: { key: 'dataTransfer.errorNoRoutines' },
      });
    }),
    TransferDeviceFake({ clipboard: '{"routines": [{"name": "Empty", "items": []}]}' }),
  );

  for (const [language, prompt] of [
    ['English', en.dataTransfer.aiPrompt],
    ['Italian', italian.dataTransfer.aiPrompt],
  ]) {
    itEffect(
      `refuses the app's own ${language} AI instructions instead of offering their example routine`,
      Effect.gen(function* () {
        const result = yield* Effect.either(readImport('clipboard'));

        expect(result._tag === 'Left' && result.left).toMatchObject({
          _tag: 'ImportUnreadable',
          issue: { key: 'dataTransfer.errorIsPrompt' },
        });
      }),
      TransferDeviceFake({ clipboard: prompt }),
    );
  }

  itEffect(
    'fails with ImportUnreadable saying the text could not be read when the clipboard fails',
    Effect.gen(function* () {
      const result = yield* Effect.either(readImport('clipboard'));

      expect(result._tag === 'Left' && result.left).toMatchObject({
        _tag: 'ImportUnreadable',
        issue: { key: 'dataTransfer.errorUnreadable' },
      });
    }),
    TransferDeviceFake({ clipboard: new Error('pasteboard unavailable') }),
  );
});
