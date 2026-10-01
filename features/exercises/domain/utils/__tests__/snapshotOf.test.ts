import { anExercise } from '@/features/exercises/__fixtures__/builders';
import { snapshotOf } from '@/features/exercises/domain/utils/snapshotOf';

describe('snapshotOf', () => {
  it('copies what the exercise says, its images as asset paths, and stamps the capture time', () => {
    const snapshot = snapshotOf(
      anExercise({
        imageUrl: 'assets/catalog/images/barbell-bench-press/0.webp',
        imageEndUrl: 'assets/catalog/images/barbell-bench-press/1.webp',
        thumbnailUrl: 'assets/catalog/images/barbell-bench-press/thumb.webp',
      }),
      1_700_000_000_000,
    );

    expect(snapshot).toEqual({
      exerciseId: 'ex:barbell-bench-press',
      name: 'Barbell Bench Press',
      instructions: ['Lower the bar to the chest, then press.'],
      category: 'Chest',
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Triceps'],
      equipment: ['Barbell'],
      imageUrl: 'assets/catalog/images/barbell-bench-press/0.webp',
      thumbnailUrl: 'assets/catalog/images/barbell-bench-press/thumb.webp',
      capturedAt: 1_700_000_000_000,
    });
  });

  it('falls back to the full image when the exercise has no thumbnail', () => {
    expect(snapshotOf(anExercise({ imageUrl: 'big.png', thumbnailUrl: null }), 0).thumbnailUrl).toBe('big.png');
  });
});
