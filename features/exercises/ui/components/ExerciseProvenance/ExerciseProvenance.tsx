import { ICON_SIZE, Icon, Row, Txt, useStyles } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { shortDateLabel } from '@/features/core/utils';
import type { ExerciseSourceKind } from '@/features/exercises/domain/entities/ExerciseSourceKind';
import { createStyles } from '@/features/exercises/ui/components/ExerciseProvenance/ExerciseProvenance.style';

/**
 * One line under the hero saying where the exercise on screen came from. A stored copy is dated,
 * which explains why it shows less than the library would. The library is bundled, so there is
 * nothing to check a stored copy against: the catalog either has the exercise or never will.
 */
export function ExerciseProvenance({ from, storedAt }: { from: ExerciseSourceKind; storedAt: number | null }) {
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);

  if (from === 'stored') {
    return (
      <Row gap="sm" align="center">
        <Icon name="offline" size={ICON_SIZE.micro} color={theme.colors.info} />
        <Txt variant="caption" tone="muted" style={styles.flex}>
          {storedAt === null
            ? t('exerciseDetail.offlineCopy')
            : t('exerciseDetail.offlineCopyDated', { date: shortDateLabel(storedAt) })}
        </Txt>
      </Row>
    );
  }

  if (from === 'catalog') {
    return (
      <Row gap="sm" align="center">
        <Icon name="layers" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
        <Txt variant="caption" tone="muted">
          {t('exerciseDetail.fromLibrary')}
        </Txt>
      </Row>
    );
  }

  return (
    <Row gap="sm" align="center">
      <Icon name="info" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
      <Txt variant="caption" tone="muted">
        {t('exerciseDetail.builtIn')}
      </Txt>
    </Row>
  );
}
