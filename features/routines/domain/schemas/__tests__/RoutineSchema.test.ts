import { Either, Schema } from 'effect';
import { aDurationItem, aRepsOnlyItem, aRoutine, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { RoutineSchema } from '@/features/routines/domain/schemas/RoutineSchema';

describe('RoutineSchema', () => {
  it('accepts the builder’s routine as it is', () => {
    expect(Schema.decodeUnknownEither(RoutineSchema)(aRoutine())).toEqual(Either.right(aRoutine()));
  });

  it('accepts an item of each tracking type', () => {
    const routine = aRoutine({ items: [aRoutineItem(), aRepsOnlyItem(), aDurationItem()] });

    expect(Schema.decodeUnknownEither(RoutineSchema)(routine)).toEqual(Either.right(routine));
  });

  it('rejects an item holding a set of another type than its own', () => {
    const mixed = { ...aRepsOnlyItem(), sets: [...aRepsOnlyItem().sets, ...aDurationItem().sets] };

    expect(Either.isLeft(Schema.decodeUnknownEither(RoutineSchema)({ ...aRoutine(), items: [mixed] }))).toBe(true);
  });

  it('rejects an item of a type the app does not know', () => {
    const distance = { ...aRoutineItem(), trackingType: 'distance' };

    expect(Either.isLeft(Schema.decodeUnknownEither(RoutineSchema)({ ...aRoutine(), items: [distance] }))).toBe(true);
  });

  it('rejects a routine with an empty id', () => {
    expect(Either.isLeft(Schema.decodeUnknownEither(RoutineSchema)({ ...aRoutine(), id: '' }))).toBe(true);
  });
});
