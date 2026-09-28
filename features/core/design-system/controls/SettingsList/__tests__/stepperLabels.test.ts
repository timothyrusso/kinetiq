import { stepperLabels } from '@/features/core/design-system/controls/SettingsList/stepperLabels';
import { setLanguagePreference, tr } from '@/features/core/translations';

describe('stepperLabels', () => {
  afterEach(() => setLanguagePreference('system'));

  it('names the minus and plus after the row in English', () => {
    setLanguagePreference('en');

    expect(stepperLabels('Time', tr)).toEqual({ decrease: 'Decrease Time', increase: 'Increase Time' });
  });

  it('names the minus and plus after the row in Italian', () => {
    setLanguagePreference('it');

    expect(stepperLabels('Orario', tr)).toEqual({ decrease: 'Diminuisci Orario', increase: 'Aumenta Orario' });
  });
});
