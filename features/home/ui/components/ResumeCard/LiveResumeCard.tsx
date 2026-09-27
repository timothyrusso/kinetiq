import { View } from 'react-native';
import { Card, MetaLine, ProgressRing, Row, Txt, useStyles } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { useLiveResumeCardLogic } from '@/features/home/ui/components/ResumeCard/LiveResumeCard.logic';
import { createStyles } from '@/features/home/ui/components/ResumeCard/ResumeCard.style';

/** The "pick up where you left off" card. Deliberately loud: the only urgent thing on the tab. */
export function LiveResumeCard({ onPress }: { onPress: () => void }) {
  const { derived } = useLiveResumeCardLogic();
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);
  const { card } = derived;
  if (card === null) return null;
  return (
    <View style={styles.section}>
      <Card tone="accent" onPress={onPress} accessibilityLabel={card.accessibilityLabel}>
        <Row gap="lg" align="center">
          <View style={styles.body}>
            <Row gap="sm" align="center">
              <View style={[styles.dot, card.paused ? styles.dotPaused : styles.dotLive]} />
              <Txt variant="micro" uppercase tracking={0.8} weight="700">
                {t(card.paused ? 'workout.paused' : 'workoutTab.trainingNow')}
              </Txt>
            </Row>
            <Txt variant="title" weight="700" numberOfLines={1} style={styles.title}>
              {card.name}
            </Txt>
            <MetaLine items={card.meta} theme={theme} style={styles.meta} />
          </View>
          <ProgressRing progress={card.progress} theme={theme} size={56} strokeWidth={6} label={card.progressLabel} />
        </Row>
      </Card>
    </View>
  );
}
