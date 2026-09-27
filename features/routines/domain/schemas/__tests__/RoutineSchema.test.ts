import { Either, Schema } from 'effect';
import { aRoutine } from '@/features/routines/__fixtures__/builders';
import { RoutineSchema } from '@/features/routines/domain/schemas/RoutineSchema';

describe('RoutineSchema', () => {
  it('accepts the builder’s routine as it is', () => {
    expect(Schema.decodeUnknownEither(RoutineSchema)(aRoutine())).toEqual(Either.right(aRoutine()));
  });

  it('rejects a routine with an empty id', () => {
    expect(Either.isLeft(Schema.decodeUnknownEither(RoutineSchema)({ ...aRoutine(), id: '' }))).toBe(true);
  });
});
