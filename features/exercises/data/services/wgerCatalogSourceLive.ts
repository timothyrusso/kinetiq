import { Effect, Layer } from 'effect';
import { AppConfig } from '@/features/core/config';
import { downloadWgerCatalog } from '@/features/exercises/data/services/downloadWgerCatalog';
import { singleFlight } from '@/features/exercises/data/services/singleFlight';
import { type FetchImpl, makeWgerGetJson } from '@/features/exercises/data/services/wgerHttp';
import { CatalogFetchFailed } from '@/features/exercises/domain/errors/CatalogFetchFailed';
import { CatalogSource } from '@/features/exercises/domain/services/CatalogSource';

/**
 * The catalog download from the wger REST API at `wgerBaseUrl`, over `fetchImpl`. A foreground
 * event during a manual refresh, or a double tap, joins the download already running instead of
 * starting a second one.
 */
export const makeWgerCatalogSource = (fetchImpl: FetchImpl) =>
  Layer.effect(
    CatalogSource,
    Effect.gen(function* () {
      const { wgerBaseUrl } = yield* AppConfig.Config;
      const fetch = yield* singleFlight(
        downloadWgerCatalog(
          wgerBaseUrl,
          makeWgerGetJson(fetchImpl),
          (endpoint, cause) => new CatalogFetchFailed({ endpoint, cause }),
        ),
      );
      return { fetch };
    }),
  );

/** The download over the platform's `fetch`. */
export const WgerCatalogSourceLive = makeWgerCatalogSource((url, init) => fetch(url, init));
