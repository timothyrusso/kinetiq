import { AppErrorBase } from '@/features/core/error';

/**
 * wger answered, but `endpoint` sent something that is not the catalog the app can read: the
 * response failed its Schema. Nothing has been written.
 */
export class CatalogFetchFailed extends AppErrorBase('CatalogFetchFailed', 'errors.catalogFetchFailed')<{
  readonly endpoint: string;
}> {}
