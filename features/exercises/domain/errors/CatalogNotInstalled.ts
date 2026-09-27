import { AppErrorBase } from '@/features/core/error';

/** The catalog shipped with the app could not be read, so there is no catalog to install. */
export class CatalogNotInstalled extends AppErrorBase('CatalogNotInstalled', 'errors.catalogNotInstalled') {}
