import { Either, Schema } from 'effect';
import { aCatalogExercise, aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import { CatalogPayloadSchema } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';

const decode = Schema.decodeUnknownEither(CatalogPayloadSchema);

describe('CatalogPayloadSchema', () => {
  it('decodes a format 1 payload as it is, a missing translation staying missing', () => {
    const payload = aCatalogPayload([aCatalogExercise(10, { en: 'Dips' })]);

    expect(decode(JSON.parse(JSON.stringify(payload)))).toEqual(Either.right(payload));
  });

  it('rejects another format version', () => {
    expect(Either.isLeft(decode({ ...aCatalogPayload(), formatVersion: 2 }))).toBe(true);
  });

  it('rejects an exercise id outside the wger namespace', () => {
    const exercise = { ...aCatalogExercise(), id: 'local:bench-press' };

    expect(Either.isLeft(decode({ ...aCatalogPayload(), exercises: [exercise] }))).toBe(true);
  });
});
