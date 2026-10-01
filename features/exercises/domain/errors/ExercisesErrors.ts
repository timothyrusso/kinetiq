import { CatalogNotInstalled } from '@/features/exercises/domain/errors/CatalogNotInstalled';

export { CatalogNotInstalled };

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    exercises: CatalogNotInstalled;
  }
}
