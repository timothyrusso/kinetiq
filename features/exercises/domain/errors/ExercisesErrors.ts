import { CatalogFetchFailed } from '@/features/exercises/domain/errors/CatalogFetchFailed';
import { CatalogNotInstalled } from '@/features/exercises/domain/errors/CatalogNotInstalled';
import { ExerciseNotFound } from '@/features/exercises/domain/errors/ExerciseNotFound';

export { CatalogFetchFailed, CatalogNotInstalled, ExerciseNotFound };

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    exercises: CatalogNotInstalled | CatalogFetchFailed | ExerciseNotFound;
  }
}
