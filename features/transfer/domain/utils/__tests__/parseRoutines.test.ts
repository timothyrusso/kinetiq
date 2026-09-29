import type { ImportRules } from '@/features/transfer/domain/entities/ImportRules';
import { parseRoutines } from '@/features/transfer/domain/utils/parseRoutines';

const rules: ImportRules = {
  limits: { bytes: 1000, routines: 2, itemsPerRoutine: 2 },
  bounds: {
    sets: { min: 1, max: 3 },
    reps: { min: 1, max: 100 },
    weightKg: { min: 0, max: 450 },
    targetRpe: { min: 0, max: 10 },
    restSeconds: { min: 0, max: 600 },
    notesLength: 10,
  },
  isExerciseId: id => id.startsWith('wger:') || id.startsWith('local:'),
};

const routinesOf = (raw: string) => {
  const parsed = parseRoutines(raw, rules);
  if (!parsed.ok) throw new Error(parsed.issue.key);
  return parsed;
};

describe('parseRoutines', () => {
  it('reads a bare array of routines', () => {
    expect(routinesOf('[{"name": "A", "items": [{"exerciseName": "Row"}]}]').routines.map(r => r.name)).toEqual(['A']);
  });

  it('reads a single routine given as its own document', () => {
    expect(routinesOf('{"exercises": [{"name": "Row"}]}').routines).toHaveLength(1);
  });

  it('turns a bare catalog number into a wger id and drops an id it does not know', () => {
    const { routines } = routinesOf(
      '[{"items": [{"exerciseId": 192, "name": "A"}, {"exerciseId": "abc", "name": "B"}]}]',
    );

    expect(routines[0]?.items.map(item => item.exerciseId)).toEqual(['wger:192', null]);
  });

  it('rounds the weight to a quarter kilo and clamps it to the bounds', () => {
    const { routines } = routinesOf('[{"items": [{"name": "A", "weightKg": 61.3}, {"name": "B", "weightKg": 999}]}]');

    expect(routines[0]?.items.map(item => item.sets[0]?.weightKg)).toEqual([61.25, 450]);
  });

  it('reads v2 rows as they are and keeps only as many as an item holds', () => {
    const { routines, issues } = routinesOf(
      JSON.stringify([
        {
          items: [
            {
              name: 'A',
              sets: [1, 2, 3, 4].map(n => ({ reps: n, weightKg: n * 10, targetRpe: n === 1 ? null : n + 5 })),
            },
          ],
        },
      ]),
    );

    expect(routines[0]?.items[0]?.sets).toEqual([
      { reps: 1, weightKg: 10, targetRpe: null },
      { reps: 2, weightKg: 20, targetRpe: 7 },
      { reps: 3, weightKg: 30, targetRpe: 8 },
    ]);
    expect(issues).toEqual([]);
  });

  it('turns a v1 count and range into identical sets on the bottom of the range, whatever version it claims', () => {
    const { routines } = routinesOf(
      '{"version": 2, "routines": [{"items": [{"name": "A", "sets": 2, "reps": "8\u201312", "weightKg": 50}]}]}',
    );

    expect(routines[0]?.items[0]?.sets).toEqual([
      { reps: 8, weightKg: 50, targetRpe: null },
      { reps: 8, weightKg: 50, targetRpe: null },
    ]);
  });

  it('cuts notes to the bound', () => {
    const { routines } = routinesOf('[{"items": [{"name": "A", "notes": "a very long note"}]}]');

    expect(routines[0]?.items[0]?.notes).toBe('a very lon');
  });

  it('keeps the first routines up to the limit and reports the rest', () => {
    const parsed = routinesOf(
      JSON.stringify([1, 2, 3].map(n => ({ name: `R${n}`, items: [{ name: 'A', sets: 3, reps: '8' }] }))),
    );

    expect(parsed.routines.map(r => r.name)).toEqual(['R1', 'R2']);
    expect(parsed.issues).toEqual([{ key: 'dataTransfer.issueTooMany', vars: { count: 2 } }]);
  });

  it('fails on text past the byte limit before parsing it', () => {
    expect(parseRoutines(`[${' '.repeat(1000)}]`, rules)).toEqual({
      ok: false,
      issue: { key: 'dataTransfer.errorTooLarge' },
    });
  });
});
