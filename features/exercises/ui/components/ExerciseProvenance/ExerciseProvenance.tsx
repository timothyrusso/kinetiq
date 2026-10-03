import { ICON_SIZE, Icon, Row, Txt } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { ExerciseSourceKind } from '@/features/exercises/domain/entities/ExerciseSourceKind';

/**
 * One line under the hero for an exercise neither the library nor a stored copy knows. The
 * library's row and a stored copy need no line: the library is bundled, so a stored copy is the
 * same data the library once had, and saying where it came from explains nothing.
 */
export function ExerciseProvenance({ from }: { from: ExerciseSourceKind }) {
  const { t } = useT();
  const theme = useAppTheme();

  if (from !== 'none') return null;

  return (
    <Row gap="sm" align="center">
      <Icon name="info" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
      <Txt variant="caption" tone="muted">
        {t('exerciseDetail.builtIn')}
      </Txt>
    </Row>
  );
}
