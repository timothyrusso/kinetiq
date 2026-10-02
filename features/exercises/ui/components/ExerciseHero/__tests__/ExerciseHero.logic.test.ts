import { noArtCaptionKey } from '@/features/exercises/ui/components/ExerciseHero/ExerciseHero.logic';

describe('noArtCaptionKey', () => {
  it('says a catalog exercise has no photo yet', () => {
    expect(noArtCaptionKey('ex:barbell-squat', false)).toBe('exerciseDetail.noImage');
  });

  it('drops the "yet" for a custom exercise, which never gets a bundled photo', () => {
    expect(noArtCaptionKey('local:my-squat', false)).toBe('exerciseDetail.noBundledImage');
  });

  it('drops the "yet" for an id outside the catalog namespace', () => {
    expect(noArtCaptionKey('1234', false)).toBe('exerciseDetail.noBundledImage');
  });

  it('says a bundled photo could not be shown when it failed to load', () => {
    expect(noArtCaptionKey('ex:barbell-squat', true)).toBe('exerciseDetail.imageUnavailable');
  });
});
