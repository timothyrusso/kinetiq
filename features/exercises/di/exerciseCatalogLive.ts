import { Effect, Layer } from 'effect';
import type { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';
import { ExerciseCatalog } from '@/features/exercises/domain/services/ExerciseCatalog';
import { getExercise } from '@/features/exercises/useCases/getExercise';
import { installBundledCatalogIfNewer } from '@/features/exercises/useCases/installBundledCatalogIfNewer';
import { searchExercises } from '@/features/exercises/useCases/searchExercises';

type CatalogServices = CatalogRepository | BundledCatalog;

/** `ExerciseCatalog` over this feature's own use cases and the services they read. */
export const ExerciseCatalogLive = Layer.effect(
  ExerciseCatalog,
  Effect.map(Effect.context<CatalogServices>(), services => {
    const run = <A, E>(effect: Effect.Effect<A, E, CatalogServices>) => Effect.provide(effect, services);
    return {
      installBundledIfNewer: run(installBundledCatalogIfNewer),
      find: (id, language) => run(getExercise(id, language)).pipe(Effect.map(exercise => exercise ?? undefined)),
      search: (name, language) =>
        run(searchExercises({ query: name, bodyArea: null, equipment: null, muscle: null }, language)).pipe(
          Effect.map(page => page.items),
        ),
    };
  }),
);
