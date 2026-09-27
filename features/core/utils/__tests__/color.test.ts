import { withAlpha } from '@/features/core/utils';

describe('withAlpha', () => {
  it('appends the alpha as a hex byte', () => {
    expect(withAlpha('#FF8800', 0.5)).toBe('#ff880080');
  });

  it('expands a three-digit colour first', () => {
    expect(withAlpha('#f80', 1)).toBe('#ff8800ff');
  });

  it('clamps the alpha to the unit range', () => {
    expect([withAlpha('#000000', -1), withAlpha('#000000', 2)]).toEqual(['#00000000', '#000000ff']);
  });

  it('returns a colour it cannot read unchanged', () => {
    expect(withAlpha('tomato', 0.5)).toBe('tomato');
  });
});
