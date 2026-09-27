import { type ProfileDraft, validateProfileDraft } from '@/features/profile/domain/utils/profileDraft';

const aDraft = (overrides: Partial<ProfileDraft> = {}): ProfileDraft => ({
  name: 'Sam',
  heightCm: '181',
  birthYear: '1990',
  ...overrides,
});

describe('validateProfileDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateProfileDraft(aDraft(), 2026)).toBeNull();
  });

  it('accepts an empty name, which keeps the default', () => {
    expect(validateProfileDraft(aDraft({ name: '  ' }), 2026)).toBeNull();
  });

  it('refuses a one-letter name', () => {
    expect(validateProfileDraft(aDraft({ name: 'S' }), 2026)).toEqual({ name: 'nameTooShort' });
  });

  it('refuses an empty height, a height that is not a number and one out of range', () => {
    expect(validateProfileDraft(aDraft({ heightCm: '' }), 2026)).toEqual({ heightCm: 'heightRequired' });
    expect(validateProfileDraft(aDraft({ heightCm: 'tall' }), 2026)).toEqual({ heightCm: 'heightNotNumber' });
    expect(validateProfileDraft(aDraft({ heightCm: '99' }), 2026)).toEqual({ heightCm: 'heightRange' });
    expect(validateProfileDraft(aDraft({ heightCm: '231' }), 2026)).toEqual({ heightCm: 'heightRange' });
  });

  it('refuses an empty birth year, one that is not a number, one before 1930 and one in the future', () => {
    expect(validateProfileDraft(aDraft({ birthYear: '' }), 2026)).toEqual({ birthYear: 'birthYearRequired' });
    expect(validateProfileDraft(aDraft({ birthYear: 'x' }), 2026)).toEqual({ birthYear: 'birthYearNotNumber' });
    expect(validateProfileDraft(aDraft({ birthYear: '1929' }), 2026)).toEqual({ birthYear: 'birthYearRange' });
    expect(validateProfileDraft(aDraft({ birthYear: '2027' }), 2026)).toEqual({ birthYear: 'birthYearRange' });
  });
});
