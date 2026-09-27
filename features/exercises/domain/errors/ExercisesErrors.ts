import { CatalogFetchFailed } from '@/features/exercises/domain/errors/CatalogFetchFailed';
import { CatalogNotInstalled } from '@/features/exercises/domain/errors/CatalogNotInstalled';

export { CatalogFetchFailed, CatalogNotInstalled };

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    exercises: CatalogNotInstalled | CatalogFetchFailed;
  }
}
