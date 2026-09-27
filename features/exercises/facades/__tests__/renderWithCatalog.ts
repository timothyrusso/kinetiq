import { renderWithLayer } from '@/features/core/testing';
import { makeCatalogReadsFake } from '@/features/exercises/useCases/__tests__/catalogFakes';

/**
 * Renders `hook` over a test runtime whose catalog is a `makeCatalogRepositoryFake(options)`, with
 * no stored snapshots.
 * `done` disposes the runtime; call it at the end of the test.
 */
export const renderWithCatalog = <Props, Result>(
  hook: (props: Props) => Result,
  options: Parameters<typeof makeCatalogReadsFake>[0],
  initialProps: Props,
) => renderWithLayer(makeCatalogReadsFake(options), hook, initialProps);
