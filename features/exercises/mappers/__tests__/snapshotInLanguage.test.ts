import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { snapshotInLanguage } from '@/features/exercises/mappers/snapshotInLanguage';

/** The bench press as a routine stored it when it was picked in Italian. */
const PICKED_IN_ITALIAN: ExerciseSnapshot = {
  exerciseId: 'ex:barbell-bench-press',
  name: 'Panca piana',
  instructions: [],
  category: 'Petto',
  primaryMuscles: ['Petto'],
  secondaryMuscles: ['Tricipiti', 'Spalle'],
  equipment: ['Bilanciere', 'Cavi'],
  imageUrl: null,
  thumbnailUrl: null,
  capturedAt: 1_700_000_000_000,
};

describe('snapshotInLanguage', () => {
  it('names the category, muscles and equipment picked in Italian in English', () => {
    expect(snapshotInLanguage(PICKED_IN_ITALIAN, 'en')).toMatchObject({
      category: 'Chest',
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Triceps', 'Shoulders'],
      equipment: ['Barbell', 'Cable'],
    });
  });

  it('names a snapshot stored in English in Italian', () => {
    const stored = { ...PICKED_IN_ITALIAN, category: 'Chest', primaryMuscles: ['Chest'], equipment: ['Barbell'] };

    expect(snapshotInLanguage(stored, 'it')).toMatchObject({
      category: 'Petto',
      primaryMuscles: ['Petto'],
      equipment: ['Bilanciere'],
    });
  });

  it('keeps the exercise name in the language it was picked in', () => {
    expect(snapshotInLanguage(PICKED_IN_ITALIAN, 'en').name).toBe('Panca piana');
  });

  it('keeps a taxon the app does not name, such as one from the previous catalog, as stored', () => {
    const stored = { ...PICKED_IN_ITALIAN, primaryMuscles: ['Musculus mysterius'], equipment: ['SZ-Bar'] };

    expect(snapshotInLanguage(stored, 'en')).toMatchObject({
      primaryMuscles: ['Musculus mysterius'],
      equipment: ['SZ-Bar'],
    });
  });

  it('leaves a snapshot with no category without one', () => {
    expect(snapshotInLanguage({ ...PICKED_IN_ITALIAN, category: null }, 'en').category).toBeNull();
  });
});
