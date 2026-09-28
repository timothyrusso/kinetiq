import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { snapshotInLanguage } from '@/features/exercises/mappers/snapshotInLanguage';

/** The bench press as a routine stored it when it was picked in Italian. */
const PICKED_IN_ITALIAN: ExerciseSnapshot = {
  exerciseId: 'wger:73',
  name: 'Panca piana',
  instructions: null,
  category: 'Petto',
  primaryMuscles: ['Petto'],
  secondaryMuscles: ['Tricipiti', 'Spalle'],
  equipment: ['Bilanciere', 'Panca'],
  imageUrl: null,
  thumbnailUrl: null,
  externalId: 73,
  capturedAt: 1_700_000_000_000,
};

describe('snapshotInLanguage', () => {
  it('names the category, muscles and equipment picked in Italian in English', () => {
    expect(snapshotInLanguage(PICKED_IN_ITALIAN, 'en')).toMatchObject({
      category: 'Chest',
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Triceps', 'Shoulders'],
      equipment: ['Barbell', 'Bench'],
    });
  });

  it("names wger's English, as a snapshot stored before the app named the taxonomy, in Italian", () => {
    const stored = { ...PICKED_IN_ITALIAN, category: 'Chest', primaryMuscles: ['Chest'], equipment: ['Barbell'] };

    expect(snapshotInLanguage(stored, 'it')).toMatchObject({
      category: 'Petto',
      primaryMuscles: ['Petto'],
      equipment: ['Bilanciere'],
    });
  });

  it('keeps the exercise name as picked, and a taxon the app does not name as stored', () => {
    const stored = { ...PICKED_IN_ITALIAN, primaryMuscles: ['Musculus mysterius'], category: null };

    expect(snapshotInLanguage(stored, 'en')).toMatchObject({
      name: 'Panca piana',
      category: null,
      primaryMuscles: ['Musculus mysterius'],
    });
  });
});
