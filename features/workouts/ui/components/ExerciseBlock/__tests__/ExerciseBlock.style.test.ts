import { themeFor } from '@/features/core/theme';
import { createStyles } from '@/features/workouts/ui/components/ExerciseBlock/ExerciseBlock.style';

describe('the exercise block styles', () => {
  it('lets a long exercise name shrink and wrap instead of running into the set count', () => {
    const styles = createStyles(themeFor('light'));

    expect(styles.titles).toMatchObject({ flex: 1, minWidth: 0 });
    expect(styles.name).toMatchObject({ flexShrink: 1 });
  });
});
