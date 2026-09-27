import { renderWithLayer } from '@/features/core/testing';
import { makeCatalogRepositoryFake } from '@/features/exercises/useCases/__tests__/catalogFakes';

/**
 * Renders `hook` over a test runtime whose catalog is a `makeCatalogRepositoryFake(options)`.
 * `done` disposes the runtime; call it at the end of the test.
 */
export const renderWithCatalog = <Props, Result>(
  hook: (props: Props) => Result,
  options: Parameters<typeof makeCatalogRepositoryFake>[0],
  initialProps: Props,
) => renderWithLayer(makeCatalogRepositoryFake(options), hook, initialProps);
