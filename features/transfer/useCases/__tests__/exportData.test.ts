import { readFileSync } from 'node:fs';
import { Effect, Layer, Schema } from 'effect';
import { advanceClock, itEffect } from '@/features/core/testing';
import { EXPORTED_AT, someActivities, someRoutines } from '@/features/transfer/__fixtures__/builders';
import type { ExportFile } from '@/features/transfer/domain/entities/TransferFormat';
import { WorkoutsFileSchema } from '@/features/transfer/domain/schemas/WorkoutsFileSchema';
import {
  ActivityRepositoryFake,
  RoutineRepositoryFake,
  TransferDeviceFake,
} from '@/features/transfer/useCases/__tests__/transferFakes';
import { buildExport, exportData } from '@/features/transfer/useCases/exportData';

const fixture = (name: string) => readFileSync(`${__dirname}/../../__fixtures__/${name}`, 'utf8');

const atExportTime = advanceClock(EXPORTED_AT);

const layer = (shared: ExportFile[] = []) =>
  Layer.mergeAll(
    ActivityRepositoryFake(someActivities()),
    RoutineRepositoryFake(someRoutines()),
    TransferDeviceFake({ shared }),
  );

describe('buildExport', () => {
  itEffect(
    'writes kinetiq.workouts v2 byte for byte: v1 without the energy figure',
    Effect.gen(function* () {
      yield* atExportTime;

      const file = yield* buildExport('workoutsJson');

      expect(file).toEqual({
        name: 'kinetiq-workouts-2026-09-25.json',
        kind: 'json',
        content: fixture('kinetiq-workouts.json'),
      });
    }),
    layer(),
  );

  itEffect(
    'writes the sets CSV byte for byte, one row per set with CRLF line ends',
    Effect.gen(function* () {
      yield* atExportTime;

      const file = yield* buildExport('setsCsv');

      expect(file).toEqual({ name: 'kinetiq-sets-2026-09-25.csv', kind: 'csv', content: fixture('kinetiq-sets.csv') });
    }),
    layer(),
  );

  itEffect(
    'writes kinetiq.routines v2 byte for byte, one row per planned set',
    Effect.gen(function* () {
      yield* atExportTime;

      const file = yield* buildExport('routinesJson');

      expect(file).toEqual({
        name: 'kinetiq-routines-2026-09-25.json',
        kind: 'json',
        content: fixture('kinetiq-routines.json'),
      });
    }),
    layer(),
  );
});

describe('kinetiq.workouts v2', () => {
  it('decodes and encodes back byte for byte', () => {
    const file = fixture('kinetiq-workouts.json');
    const decoded = Schema.decodeUnknownSync(WorkoutsFileSchema)(JSON.parse(file));

    expect(JSON.stringify(Schema.encodeSync(WorkoutsFileSchema)(decoded), null, 2)).toBe(file);
  });
});

describe('exportData', () => {
  const shared: ExportFile[] = [];

  itEffect(
    'hands the export to the share sheet',
    Effect.gen(function* () {
      yield* atExportTime;

      yield* exportData('routinesJson');

      expect(shared.map(file => file.name)).toEqual(['kinetiq-routines-2026-09-25.json']);
    }),
    layer(shared),
  );
});
