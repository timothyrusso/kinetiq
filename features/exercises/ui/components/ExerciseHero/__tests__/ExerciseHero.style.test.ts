import { themeFor } from '@/features/core/theme';
import { createStyles } from '@/features/exercises/ui/components/ExerciseHero/ExerciseHero.style';

describe('the exercise hero styles', () => {
  it('puts the art on the light illustration tile in dark mode', () => {
    expect(createStyles(themeFor('dark')).image).toMatchObject({
      backgroundColor: themeFor('dark').colors.illustration,
    });
  });

  it('keeps light-mode art on the page colour', () => {
    expect(createStyles(themeFor('light')).image).toMatchObject({
      backgroundColor: themeFor('light').colors.background,
    });
  });
});
