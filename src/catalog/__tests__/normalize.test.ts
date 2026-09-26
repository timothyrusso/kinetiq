import { toSearchKey } from '../normalize';

describe('toSearchKey', () => {
  it('lowercases and folds accents', () => {
    expect(toSearchKey('Alzate Laterali Però')).toBe('alzate laterali pero');
    expect(toSearchKey('CRÈME brûlée')).toBe('creme brulee');
  });

  it('folds a precomposed and a decomposed accent to the same key', () => {
    expect(toSearchKey('piána')).toBe(toSearchKey('piána'));
  });

  it('collapses and trims whitespace', () => {
    expect(toSearchKey('  panca \t  piana\n')).toBe('panca piana');
  });

  it('keeps characters that are not accents', () => {
    expect(toSearchKey('Push-up (90°) 100%')).toBe('push-up (90°) 100%');
  });

  it('returns an empty key for blank input', () => {
    expect(toSearchKey('   ')).toBe('');
  });
});
