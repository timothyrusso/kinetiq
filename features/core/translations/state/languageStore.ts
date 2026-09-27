import { createSelectors, createStore } from '@/features/core/state';
import type { Language } from '@/features/core/translations/translate';

interface LanguageState {
  readonly language: Language;
  readonly setLanguage: (language: Language) => void;
}

const languageStore = createStore<LanguageState>(set => ({
  language: 'system',
  setLanguage: language => set({ language }),
}));

/**
 * The language copy renders in. The settings store owns the preference and mirrors it here
 * through {@link setLanguagePreference}, so translations read no feature above them.
 */
export const useLanguageStore = createSelectors(languageStore);

/** Mirrors the user's language preference into the translator. */
export function setLanguagePreference(language: Language): void {
  if (languageStore.getState().language !== language) languageStore.getState().setLanguage(language);
}
