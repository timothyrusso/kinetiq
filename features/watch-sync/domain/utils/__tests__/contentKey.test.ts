import { contentKey } from '@/features/watch-sync/domain/utils/contentKey';

describe('contentKey', () => {
  it('gives the key the phone has always sent, so a watch never re-downloads unchanged routines', () => {
    expect(contentKey('')).toBe('wvjl67o803');
    expect(contentKey('{"format":"kinetiq.watch-routines","version":1}')).toBe('wmcr0v6xur');
    expect(contentKey('Legs · Heavy')).toBe('23pj0pf4j73');
  });

  it('tells two different snapshots apart', () => {
    expect(contentKey('{"name":"Push"}')).not.toBe(contentKey('{"name":"Pull"}'));
  });
});
