import { Either, Schema } from 'effect';
import { aCatalogExercise, aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import { CatalogPayloadSchema } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';

const decode = Schema.decodeUnknownEither(CatalogPayloadSchema);

describe('CatalogPayloadSchema', () => {
  it('decodes a dataset as it is', () => {
    const payload = aCatalogPayload([aCatalogExercise('dips', { en: 'Dips' }, { force: null, mechanic: null })]);

    expect(decode(JSON.parse(JSON.stringify(payload)))).toEqual(Either.right(payload));
  });

  it('rejects a dataset version that is not a positive whole number', () => {
    expect(Either.isLeft(decode({ ...aCatalogPayload(), datasetVersion: 0 }))).toBe(true);
    expect(Either.isLeft(decode({ ...aCatalogPayload(), datasetVersion: 1.5 }))).toBe(true);
  });

  it('rejects an exercise id outside the ex: namespace', () => {
    const exercise = { ...aCatalogExercise(), id: 'local:bench-press' };

    expect(Either.isLeft(decode({ ...aCatalogPayload(), exercises: [exercise] }))).toBe(true);
  });

  it('rejects a muscle or a piece of equipment outside the vocabulary', () => {
    const muscle = { ...aCatalogExercise(), primaryMuscles: ['pecs'] };
    const equipment = { ...aCatalogExercise(), equipment: 'smith-machine' };

    expect(Either.isLeft(decode({ ...aCatalogPayload(), exercises: [muscle] }))).toBe(true);
    expect(Either.isLeft(decode({ ...aCatalogPayload(), exercises: [equipment] }))).toBe(true);
  });
});
