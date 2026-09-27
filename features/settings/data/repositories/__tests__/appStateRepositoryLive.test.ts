import { Effect, Either, Layer, Schema } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { AppStateRepositoryLive } from '@/features/settings/data/repositories/appStateRepositoryLive';
import { AppStateRepository } from '@/features/settings/domain/repositories/AppStateRepository';

const layer = () => AppStateRepositoryLive.pipe(Layer.provideMerge(makeMigratedSqliteLayer()));
const Marker = Schema.Struct({ at: Schema.Number });

describe('AppStateRepositoryLive', () => {
  itEffect(
    'reads back the value it stored, and nothing for a key never written',
    Effect.gen(function* () {
      const repository = yield* AppStateRepository;
      yield* repository.set('catalog.seen', { at: 42 });
      expect(yield* repository.get('catalog.seen', Marker)).toEqual({ at: 42 });
      expect(yield* repository.get('missing', Marker)).toBeUndefined();
    }),
    layer(),
  );

  itEffect(
    'replaces the value on a second write',
    Effect.gen(function* () {
      const repository = yield* AppStateRepository;
      yield* repository.set('catalog.seen', { at: 1 });
      yield* repository.set('catalog.seen', { at: 2 });
      expect(yield* repository.get('catalog.seen', Marker)).toEqual({ at: 2 });
    }),
    layer(),
  );

  itEffect(
    'fails with a DecodeError when the stored value is not what the schema says',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* Effect.promise(() => db.runAsync("INSERT INTO app_state (key, value_json) VALUES ('bad', '\"text\"')"));
      const result = yield* Effect.either((yield* AppStateRepository).get('bad', Marker));
      expect(Either.isLeft(result) && result.left._tag).toBe('DecodeError');
    }),
    layer(),
  );
});
