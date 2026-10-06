import type { ImportRules } from '@/features/transfer/domain/entities/ImportRules';
import { parseRoutines } from '@/features/transfer/domain/utils/parseRoutines';

const rules: ImportRules = {
  limits: { bytes: 1000, routines: 2, itemsPerRoutine: 2 },
  bounds: {
    sets: { min: 1, max: 3 },
    reps: { min: 1, max: 100 },
    weightKg: { min: 0, max: 450 },
    durationSeconds: { min: 5, max: 3600 },
    targetRpe: { min: 0, max: 10 },
    restSeconds: { min: 0, max: 600 },
    notesLength: 10,
  },
  isExerciseId: id => id.startsWith('ex:') || id.startsWith('local:'),
};

const INDEX_LINK = 'https://raw.githubusercontent.com/timothyrusso/kinetiq/main/assets/catalog/index.json';
const ROUTINE =
  '{"name": "Push", "items": [{"exerciseName": "Bench Press", "trackingType": "weightReps", "sets": 3, "reps": "8"}]}';

/** `item` with a tracking type, `weightReps` unless named. */
const typed = (item: Record<string, unknown>, trackingType = 'weightReps') => ({ ...item, trackingType });

const routinesOf = (raw: string) => {
  const parsed = parseRoutines(raw, rules);
  if (!parsed.ok) throw new Error(parsed.issue.key);
  return parsed;
};

describe('parseRoutines', () => {
  it('reads a bare array of routines', () => {
    expect(
      routinesOf('[{"name": "A", "items": [{"exerciseName": "Row", "trackingType": "weightReps"}]}]').routines.map(
        r => r.name,
      ),
    ).toEqual(['A']);
  });

  it('reads a single routine given as its own document', () => {
    expect(routinesOf('{"exercises": [{"name": "Row", "trackingType": "weightReps"}]}').routines).toHaveLength(1);
  });

  it('keeps a catalog id and drops a bare number or an id it does not know', () => {
    const { routines } = routinesOf(
      JSON.stringify([
        {
          items: [
            { exerciseId: 'ex:row', name: 'A' },
            { exerciseId: 192, name: 'B' },
          ].map(item => typed(item)),
        },
        { items: [typed({ exerciseId: 'abc', name: 'C' })] },
      ]),
    );

    expect(routines.flatMap(routine => routine.items.map(item => item.exerciseId))).toEqual(['ex:row', null, null]);
  });

  it('rounds the weight to a quarter kilo and clamps it to the bounds', () => {
    const { routines } = routinesOf(
      JSON.stringify([
        {
          items: [
            { name: 'A', weightKg: 61.3 },
            { name: 'B', weightKg: 999 },
          ].map(item => typed(item)),
        },
      ]),
    );

    expect(routines[0]?.items.map(item => item.sets[0])).toMatchObject([{ weightKg: 61.25 }, { weightKg: 450 }]);
  });

  it('reads rows as they are and keeps only as many as an item holds', () => {
    const { routines, issues } = routinesOf(
      JSON.stringify([
        {
          items: [
            typed({
              name: 'A',
              sets: [1, 2, 3, 4].map(n => ({ reps: n, weightKg: n * 10, targetRpe: n === 1 ? null : n + 5 })),
            }),
          ],
        },
      ]),
    );

    expect(routines[0]?.items[0]?.sets).toEqual([
      { type: 'weightReps', reps: 1, weightKg: 10, targetRpe: null },
      { type: 'weightReps', reps: 2, weightKg: 20, targetRpe: 7 },
      { type: 'weightReps', reps: 3, weightKg: 30, targetRpe: 8 },
    ]);
    expect(issues).toEqual([]);
  });

  it('turns a count and range into identical sets on the bottom of the range, whatever version it claims', () => {
    const { routines } = routinesOf(
      '{"version": 2, "routines": [{"items": [{"name": "A", "trackingType": "weightReps", "sets": 2, "reps": "8\u201312", "weightKg": 50}]}]}',
    );

    expect(routines[0]?.items[0]?.sets).toEqual([
      { type: 'weightReps', reps: 8, weightKg: 50, targetRpe: null },
      { type: 'weightReps', reps: 8, weightKg: 50, targetRpe: null },
    ]);
  });

  it('reads a set counted in reps alone, dropping a weight it does not record', () => {
    const { routines, issues } = routinesOf(
      JSON.stringify([
        {
          items: [
            typed({ name: 'Pull-up', sets: [{ type: 'repsOnly', reps: 12, weightKg: 20, targetRpe: 8 }] }, 'repsOnly'),
          ],
        },
      ]),
    );

    expect(routines[0]?.items[0]).toMatchObject({
      trackingType: 'repsOnly',
      sets: [{ type: 'repsOnly', reps: 12, targetRpe: 8 }],
    });
    expect(routines[0]?.items[0]?.sets[0]).not.toHaveProperty('weightKg');
    expect(issues).toEqual([]);
  });

  it('rounds a time to the second and clamps it to the duration bounds', () => {
    const { routines, issues } = routinesOf(
      JSON.stringify([
        {
          items: [
            typed({ name: 'Plank', sets: ['45.4', 9000, 2].map(durationSeconds => ({ durationSeconds })) }, 'duration'),
          ],
        },
      ]),
    );

    expect(routines[0]?.items[0]?.sets.map(set => set.type === 'duration' && set.durationSeconds)).toEqual([
      45, 3600, 5,
    ]);
    expect(issues).toEqual([]);
  });

  it('gives a timed set without a time the default of 30 s and reports it', () => {
    const { routines, issues } = routinesOf(
      JSON.stringify([{ items: [typed({ name: 'Plank', sets: [{ reps: 10 }] }, 'duration')] }]),
    );

    expect(routines[0]?.items[0]?.sets).toEqual([{ type: 'duration', durationSeconds: 30, targetRpe: null }]);
    expect(issues).toEqual([{ key: 'dataTransfer.issueDefaults', vars: { routine: 1, item: 1 } }]);
  });

  it('turns a count beside a time into identical timed sets', () => {
    const { routines } = routinesOf(
      JSON.stringify([{ items: [typed({ name: 'Wall sit', sets: 2, durationSeconds: 40 }, 'duration')] }]),
    );

    expect(routines[0]?.items[0]?.sets).toEqual([
      { type: 'duration', durationSeconds: 40, targetRpe: null },
      { type: 'duration', durationSeconds: 40, targetRpe: null },
    ]);
  });

  it('reads every row as the type of its item, whatever its own type says', () => {
    const { routines } = routinesOf(
      JSON.stringify([
        { items: [typed({ name: 'Dips', sets: [{ type: 'weightReps', reps: 10, weightKg: 20 }] }, 'repsOnly')] },
      ]),
    );

    expect(routines[0]?.items[0]?.sets).toEqual([{ type: 'repsOnly', reps: 10, targetRpe: null }]);
  });

  it('leaves out an item without a tracking type, or with one the app does not know, and reports it', () => {
    const { routines, issues } = routinesOf(
      JSON.stringify([
        { items: [typed({ name: 'Row', sets: 3 }), { name: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] }] },
        { items: [typed({ name: 'Row', sets: 3 }), { name: 'Push-up', trackingType: 'bodyweight' }] },
      ]),
    );

    expect(routines.map(routine => routine.items.map(item => item.exerciseName))).toEqual([['Row'], ['Row']]);
    expect(issues).toEqual([
      { key: 'dataTransfer.issueDefaults', vars: { routine: 1, item: 1 } },
      { key: 'dataTransfer.issueItemNoType', vars: { routine: 1, item: 2 } },
      { key: 'dataTransfer.issueDefaults', vars: { routine: 2, item: 1 } },
      { key: 'dataTransfer.issueItemNoType', vars: { routine: 2, item: 2 } },
    ]);
  });

  it('refuses a file whose items name no tracking type as one from an older version, whatever version it claims', () => {
    const older = {
      format: 'kinetiq.routines',
      version: 3,
      routines: [{ name: 'Push', items: [{ exerciseName: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] }] }],
    };

    expect(parseRoutines(JSON.stringify(older), rules)).toEqual({
      ok: false,
      issue: { key: 'dataTransfer.errorOlderFile' },
    });
  });

  it('calls a file with no item left for want of a name one with no routines, not an older one', () => {
    expect(parseRoutines('[{"items": [{"notes": "no name"}]}]', rules)).toEqual({
      ok: false,
      issue: { key: 'dataTransfer.errorNoRoutines' },
    });
  });

  it('cuts notes to the bound', () => {
    const { routines } = routinesOf(JSON.stringify([{ items: [typed({ name: 'A', notes: 'a very long note' })] }]));

    expect(routines[0]?.items[0]?.notes).toBe('a very lon');
  });

  it('keeps the first routines up to the limit and reports the rest', () => {
    const parsed = routinesOf(
      JSON.stringify([1, 2, 3].map(n => ({ name: `R${n}`, items: [typed({ name: 'A', sets: 3, reps: '8' })] }))),
    );

    expect(parsed.routines.map(r => r.name)).toEqual(['R1', 'R2']);
    expect(parsed.issues).toEqual([{ key: 'dataTransfer.issueTooMany', vars: { count: 2 } }]);
  });

  it('refuses the AI instructions, whose example runs into rules that carry the index link', () => {
    const prompt = `Reply with this shape:\n\n${ROUTINE}\n\nRules:\n- The list is at ${INDEX_LINK}: each row is [id, name].`;

    expect(parseRoutines(prompt, rules)).toEqual({ ok: false, issue: { key: 'dataTransfer.errorIsPrompt' } });
  });

  it('reads an answer that cites the index link in the prose around its JSON', () => {
    const answer = `Ids from ${INDEX_LINK}.\n\n\`\`\`json\n${ROUTINE}\n\`\`\`\nAll from ${INDEX_LINK}.`;

    expect(routinesOf(answer).routines.map(r => r.name)).toEqual(['Push']);
  });

  it('reads the fenced JSON of an answer that links the index as a markdown link', () => {
    const answer = `Ids from [the index](${INDEX_LINK}).\n\n\`\`\`json\n${ROUTINE}\n\`\`\`\nSee [the index](${INDEX_LINK}).`;

    expect(routinesOf(answer).routines.map(r => r.name)).toEqual(['Push']);
  });

  it('reads JSON from a fence with no language', () => {
    expect(routinesOf(`[link](${INDEX_LINK})\n\`\`\`\n${ROUTINE}\n\`\`\``).routines).toHaveLength(1);
  });

  it('passes over a first fence that holds no JSON for a later fence that does', () => {
    const answer = `Run this first:\n\`\`\`bash\necho [ready]\n\`\`\`\nThen import:\n\`\`\`json\n${ROUTINE}\n\`\`\``;

    expect(routinesOf(answer).routines.map(r => r.name)).toEqual(['Push']);
  });

  it('reads unfenced JSON after a fence that holds no JSON', () => {
    const answer = `\`\`\`text\nPush day, three sets\n\`\`\`\n\n${ROUTINE}`;

    expect(routinesOf(answer).routines.map(r => r.name)).toEqual(['Push']);
  });

  it('calls text that is not JSON and has no index link not JSON', () => {
    expect(parseRoutines('Here is your plan: { push day }', rules)).toEqual({
      ok: false,
      issue: { key: 'dataTransfer.errorNotJson' },
    });
  });

  it('ignores a wgerId from the retired catalog, leaving the item to be matched by its name', () => {
    const { routines } = routinesOf(JSON.stringify([{ items: [typed({ wgerId: 192, exerciseName: 'Bench Press' })] }]));

    expect(routines[0]?.items[0]).toMatchObject({ exerciseId: null, exerciseName: 'Bench Press' });
  });

  it('fails on text past the byte limit before parsing it', () => {
    expect(parseRoutines(`[${' '.repeat(1000)}]`, rules)).toEqual({
      ok: false,
      issue: { key: 'dataTransfer.errorTooLarge' },
    });
  });
});
