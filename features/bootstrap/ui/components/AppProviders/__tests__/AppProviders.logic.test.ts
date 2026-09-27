import { waitFor } from '@testing-library/react-native';
import { DefectLayer, FailedMigrationLayer } from '@/features/bootstrap/di/__tests__/bootstrapTestData';
import { useAppProvidersLogic } from '@/features/bootstrap/ui/components/AppProviders/AppProviders.logic';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';

beforeEach(() => {
  resetAllStores();
});

describe('useAppProvidersLogic', () => {
  it('shows the fatal screen with the migration failure and offers the reset', async () => {
    const { result, done } = await renderWithLayer(FailedMigrationLayer, useAppProvidersLogic, undefined);

    await waitFor(() => expect(result.current.state.phase).toBe('failed'));
    expect(result.current.derived.failureMessage).toContain('migration 10 failed');
    expect(result.current.derived.canReset).toBe(true);
    await done();
  });

  it('does not offer the reset for a failure that erasing the data cannot fix', async () => {
    const { result, done } = await renderWithLayer(DefectLayer, useAppProvidersLogic, undefined);

    await waitFor(() => expect(result.current.state.phase).toBe('failed'));
    expect(result.current.derived.canReset).toBe(false);
    await done();
  });
});
