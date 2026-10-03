import { readFileSync } from 'node:fs';
import { Effect, Layer } from 'effect';
import { itEffect } from '@/features/core/testing';
import { setLanguagePreference, tr } from '@/features/core/translations';
import { anExercise } from '@/features/transfer/__fixtures__/builders';
import {
  ExerciseCatalogFake,
  ExerciseSnapshotRepositoryFake,
  TransferDeviceFake,
} from '@/features/transfer/useCases/__tests__/transferFakes';
import { readImport } from '@/features/transfer/useCases/readImport';
import { resolveExercisesByName } from '@/features/transfer/useCases/resolveExercisesByName';

const fixture = (name: string) => readFileSync(`${__dirname}/../../__fixtures__/${name}`, 'utf8');
const INDEX_LINK = 'https://raw.githubusercontent.com/timothyrusso/kinetiq/main/assets/catalog/index.json';
const indexIds = new Set<string>(
  JSON.parse(readFileSync(`${__dirname}/../../../../assets/catalog/index.json`, 'utf8')).exercises.map(
    ([id]: [string]) => id,
  ),
);
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
    'reads a v1 export from before per-set routines, each item as its count of identical sets',
    Effect.gen(function* () {
      const read = yield* readImport('clipboard');

      expect(read?.issues).toEqual([]);
      expect(read?.routines.flatMap(routine => routine.items.map(item => [item.exerciseName, item.sets]))).toEqual([
        ['Squat, Back', Array(5).fill({ reps: 5, weightKg: 142.5, targetRpe: null })],
        ['Hip thrust', Array(3).fill({ reps: 10, weightKg: 60.25, targetRpe: null })],
        ['Bench Press', Array(3).fill({ reps: 8, weightKg: 60, targetRpe: null })],
        ['Overhead Press', Array(4).fill({ reps: 6, weightKg: 40, targetRpe: null })],
      ]);
    }),
    TransferDeviceFake({ clipboard: fixture('kinetiq-routines.v1.json') }),
  );

  itEffect(
    "reads an AI's v2 answer row by row, clamping, defaulting and reporting",
    Effect.gen(function* () {
      expect(yield* readImport('clipboard')).toEqual(parsedFixture('ai-answer.v2.parsed.json'));
    }),
    TransferDeviceFake({ clipboard: fixture('ai-answer.v2.txt') }),
  );

  itEffect(
    "reads an AI's v1 answer in a code fence, clamping, defaulting and reporting as the app always has",
    Effect.gen(function* () {
      expect(yield* readImport('clipboard')).toEqual(parsedFixture('ai-answer.parsed.json'));
    }),
    TransferDeviceFake({ clipboard: fixture('ai-answer.txt') }),
  );

  for (const file of ['kinetiq-workouts.json', 'kinetiq-workouts.v1.json']) {
    itEffect(
      `refuses a workout history file (${file}) as holding no routines, as the app always has`,
      Effect.gen(function* () {
        const result = yield* Effect.either(readImport('clipboard'));

        expect(result._tag === 'Left' && result.left).toMatchObject({
          _tag: 'ImportUnreadable',
          issue: { key: 'dataTransfer.errorNoRoutines' },
        });
      }),
      TransferDeviceFake({ clipboard: fixture(file) }),
    );
  }

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

  afterEach(() => setLanguagePreference('system'));

  for (const language of ['en', 'it'] as const) {
    setLanguagePreference(language);
    const prompt = tr('dataTransfer.aiPrompt');
    setLanguagePreference('system');

    it(`links the public exercise index in the ${language} AI instructions`, () => {
      expect(prompt).toContain('https://raw.githubusercontent.com/timothyrusso/kinetiq/main/assets/catalog/index.json');
    });

    itEffect(
      `refuses the app's own AI instructions in ${language} instead of offering their example routine`,
      Effect.gen(function* () {
        const result = yield* Effect.either(readImport('clipboard'));

        expect(result._tag === 'Left' && result.left).toMatchObject({
          _tag: 'ImportUnreadable',
          issue: { key: 'dataTransfer.errorIsPrompt' },
        });
      }),
      TransferDeviceFake({ clipboard: prompt }),
    );

    itEffect(
      `reads the example in the ${language} AI instructions as a v2 routine, one row per set`,
      Effect.gen(function* () {
        const read = yield* readImport('clipboard');

        expect(read?.issues).toEqual([]);
        expect(indexIds.has(read?.routines[0]?.items[0]?.exerciseId ?? '')).toBe(true);
        expect(read?.routines[0]?.items[0]?.sets).toEqual([
          { reps: 10, weightKg: 50, targetRpe: null },
          { reps: 8, weightKg: 60, targetRpe: 7 },
          { reps: 8, weightKg: 60, targetRpe: 8 },
        ]);
      }),
      TransferDeviceFake({ clipboard: prompt.slice(prompt.indexOf('{'), prompt.indexOf('\n\n', prompt.indexOf('{'))) }),
    );

    itEffect(
      `reads an answer to the ${language} AI instructions that cites the index link around its JSON`,
      Effect.gen(function* () {
        const read = yield* readImport('clipboard');

        expect(read?.routines[0]?.name).toBe('Push Day');
        expect(read?.routines[0]?.items[0]?.sets).toHaveLength(3);
      }),
      TransferDeviceFake({
        clipboard: `I took the ids from ${INDEX_LINK}.\n\n\`\`\`json\n${prompt.slice(
          prompt.indexOf('{'),
          prompt.indexOf('\n\n', prompt.indexOf('{')),
        )}\n\`\`\`\n\nEvery exerciseId is copied from ${INDEX_LINK}.`,
      }),
    );

    itEffect(
      `reads an answer to the ${language} AI instructions that links the index as a markdown link`,
      Effect.gen(function* () {
        const read = yield* readImport('clipboard');

        expect(read?.routines[0]?.name).toBe('Push Day');
      }),
      TransferDeviceFake({
        clipboard: `I took the ids from [the exercise index](${INDEX_LINK}).\n\n\`\`\`json\n${prompt.slice(
          prompt.indexOf('{'),
          prompt.indexOf('\n\n', prompt.indexOf('{')),
        )}\n\`\`\``,
      }),
    );
  }

  itEffect(
    'ignores the wgerId of an answer written for the retired catalog and matches the item by name',
    Effect.gen(function* () {
      const read = yield* readImport('clipboard');
      const [routine] = yield* resolveExercisesByName(read?.routines ?? [], 'en');

      expect(read?.routines[0]?.items[0]?.exerciseId).toBeNull();
      expect(routine?.items[0]?.match).toMatchObject({
        status: 'catalog',
        snapshot: { exerciseId: 'ex:barbell-bench-press-medium-grip', name: 'Bench Press' },
      });
    }),
    Layer.mergeAll(
      TransferDeviceFake({
        clipboard:
          '{"routines": [{"name": "Push", "items": [{"wgerId": 192, "exerciseName": "Bench Press", "sets": 3}]}]}',
      }),
      ExerciseSnapshotRepositoryFake(new Map()),
      ExerciseCatalogFake([anExercise()]),
    ),
  );

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
