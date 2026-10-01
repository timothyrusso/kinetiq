import { Effect } from 'effect';
import { itEffect } from '@/features/core/testing';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { makeExerciseSnapshotRepositoryFake } from '@/features/exercises/useCases/__tests__/catalogFakes';
import { getStoredExercise } from '@/features/exercises/useCases/getStoredExercise';

const stored: ExerciseSnapshot = {
  exerciseId: 'local:hip-thrust',
  name: 'Hip Thrust',
  instructions: [],
  category: 'Legs',
  primaryMuscles: ['Glutes'],
  secondaryMuscles: [],
  equipment: ['Barbell'],
  imageUrl: null,
  thumbnailUrl: null,
  capturedAt: 1_700_000_000_000,
};

describe('getStoredExercise', () => {
  itEffect(
    'returns the stored copy of an exercise',
    Effect.gen(function* () {
      expect(yield* getStoredExercise('local:hip-thrust')).toEqual(stored);
    }),
    makeExerciseSnapshotRepositoryFake([stored]),
  );

  itEffect(
    'returns null for an exercise nothing has stored',
    Effect.gen(function* () {
      expect(yield* getStoredExercise('ex:barbell-bench-press')).toBeNull();
    }),
    makeExerciseSnapshotRepositoryFake([stored]),
  );
});
