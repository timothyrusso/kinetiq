import { exerciseLibraryTags, exerciseTags } from '@/features/core/design-system/display/exerciseTags';

describe('exerciseTags', () => {
  it('leaves out a category a primary muscle already names', () => {
    expect(exerciseTags({ primaryMuscles: ['Shoulders'], category: 'shoulders' })).toEqual([
      { key: 'm:Shoulders', label: 'Shoulders' },
    ]);
  });
});

describe('exerciseLibraryTags', () => {
  it('lists the taxonomy, then the equipment', () => {
    expect(
      exerciseLibraryTags({ primaryMuscles: ['Chest'], category: 'Push', equipment: ['Barbell', 'Bench'] }),
    ).toEqual([
      { key: 'm:Chest', label: 'Chest' },
      { key: 'c:Push', label: 'Push', tone: 'accent' },
      { key: 'e:Barbell', label: 'Barbell' },
      { key: 'e:Bench', label: 'Bench' },
    ]);
  });
});
