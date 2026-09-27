import { getLocales } from 'expo-localization';
import { resolveLanguage } from '@/features/core/translations/translate';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

const mockedGetLocales = jest.mocked(getLocales);

/** The device's preference list, as `getLocales()` reports it: first is most preferred. */
function givenDeviceLanguages(...codes: (string | null)[]) {
  mockedGetLocales.mockReturnValue(codes.map(languageCode => ({ languageCode })) as ReturnType<typeof getLocales>);
}

describe('resolveLanguage', () => {
  it('keeps an explicit choice whatever the device says', () => {
    givenDeviceLanguages('it');

    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('it')).toBe('it');
  });

  it('follows English when it comes before Italian in the device list', () => {
    givenDeviceLanguages('en', 'de', 'fr', 'it');

    expect(resolveLanguage('system')).toBe('en');
  });

  it('follows Italian when it comes before English in the device list', () => {
    givenDeviceLanguages('de', 'it', 'en');

    expect(resolveLanguage('system')).toBe('it');
  });

  it('falls back to English when the device lists neither', () => {
    givenDeviceLanguages('de', null, 'fr');

    expect(resolveLanguage('system')).toBe('en');
  });
});
