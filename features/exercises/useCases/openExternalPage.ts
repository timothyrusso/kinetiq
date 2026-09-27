import { Effect } from 'effect';
import { ExternalPages } from '@/features/exercises/domain/services/ExternalPages';

/** Opens `url` in the system browser. */
export const openExternalPage = (url: string) => Effect.flatMap(ExternalPages, pages => pages.open(url));
