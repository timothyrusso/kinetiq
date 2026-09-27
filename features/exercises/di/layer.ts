import { Layer } from 'effect';
import { CatalogRepositoryLive } from '@/features/exercises/data/repositories/catalogRepositoryLive';
import { ExerciseSnapshotRepositoryLive } from '@/features/exercises/data/repositories/exerciseSnapshotRepositoryLive';
import { BundledCatalogSourceLive } from '@/features/exercises/data/services/bundledCatalogSourceLive';
import { WgerCatalogSourceLive } from '@/features/exercises/data/services/wgerCatalogSourceLive';
import { ExerciseCatalogLive } from '@/features/exercises/di/exerciseCatalogLive';

/**
 * Every Layer `exercises` provides: the catalog in SQLite, its wger download, the bundled copy, the
 * stored snapshots, and the catalog as the features above use it.
 */
export const ExercisesLive = ExerciseCatalogLive.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      CatalogRepositoryLive,
      WgerCatalogSourceLive,
      BundledCatalogSourceLive,
      ExerciseSnapshotRepositoryLive,
    ),
  ),
);
