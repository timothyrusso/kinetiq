import { anExercise } from '@/features/exercises/__fixtures__/builders';
import { snapshotOf } from '@/features/exercises/domain/utils/snapshotOf';

describe('snapshotOf', () => {
  it('copies what the exercise says and stamps the capture time', () => {
    const snapshot = snapshotOf(anExercise({ imageUrl: 'big.png', thumbnailUrl: 'small.png' }), 1_700_000_000_000);

    expect(snapshot).toEqual({
      exerciseId: 'wger:10',
      name: 'Bench Press',
      instructions: 'Lower the bar to the chest, then press.',
      category: 'Chest',
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Triceps brachii'],
      equipment: ['Barbell'],
      imageUrl: 'big.png',
      thumbnailUrl: 'small.png',
      externalId: 10,
      capturedAt: 1_700_000_000_000,
    });
  });

  it('falls back to the full image when the exercise has no thumbnail', () => {
    expect(snapshotOf(anExercise({ imageUrl: 'big.png', thumbnailUrl: null }), 0).thumbnailUrl).toBe('big.png');
  });
});
