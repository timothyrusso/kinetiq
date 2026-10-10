import { tr } from '@/features/core/translations';
import { PersonalRecordKindSchema } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import { formatRecordValue, RECORD_LABEL } from '@/features/workouts/mappers/recordLabels';

describe('the record labels', () => {
  it('name every kind, each differently', () => {
    const labels = PersonalRecordKindSchema.literals.map(kind => tr(RECORD_LABEL[kind]));

    expect(new Set(labels).size).toBe(PersonalRecordKindSchema.literals.length);
  });

  it('read each kind in its own unit', () => {
    expect(formatRecordValue('est1rm', 116.5, 'metric')).toBe('116.5 kg');
    expect(formatRecordValue('volume', 1000, 'metric')).toBe('1,000 kg');
    expect(formatRecordValue('maxReps', 12, 'metric')).toBe(tr('details.repsValue', { reps: 12 }));
    expect(formatRecordValue('mostReps', 14.4, 'metric')).toBe(tr('details.repsValue', { reps: 14 }));
    expect(formatRecordValue('longestDuration', 95, 'metric')).toBe('1:35');
  });
});
