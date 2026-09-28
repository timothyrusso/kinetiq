import { chipLabels } from '@/features/core/design-system/controls/Chip/chipLabels';
import { setLanguagePreference, tr } from '@/features/core/translations';

describe('chipLabels', () => {
  afterEach(() => setLanguagePreference('system'));

  it('reads the label alone when the chip has no count', () => {
    setLanguagePreference('en');

    expect(chipLabels('Chest', undefined, tr).chip).toBe('Chest');
  });

  it('names the result count and the remove control in English', () => {
    setLanguagePreference('en');

    expect(chipLabels('Chest', 12, tr)).toEqual({ chip: 'Chest, 12 results', remove: 'Remove Chest filter' });
    expect(chipLabels('Chest', 1, tr).chip).toBe('Chest, 1 result');
  });

  it('names the result count and the remove control in Italian', () => {
    setLanguagePreference('it');

    expect(chipLabels('Petto', 12, tr)).toEqual({ chip: 'Petto, 12 risultati', remove: 'Rimuovi il filtro Petto' });
    expect(chipLabels('Petto', 1, tr).chip).toBe('Petto, 1 risultato');
  });
});
