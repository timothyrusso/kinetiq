import { memo } from 'react';
import { View } from 'react-native';
import { IconButton, Row, Txt, useStyles } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { formatTimer } from '@/features/core/utils';
import { type RestDockInput, useRestDockLogic } from '@/features/workouts/ui/components/RestDock/RestDock.logic';
import { createStyles } from '@/features/workouts/ui/components/RestDock/RestDock.style';

/**
 * The rest-timer dock, pinned above the screen's footer rather than left in the scroll: a timer
 * that scrolls away gets forgotten, and the point of a countdown is that you stop watching it. No
 * drag to dismiss: this floats over set rows, and a pan here would swallow taps meant for them.
 *
 * The bar is a determinate linear track, not a ring: a ring needs an arc for an honest sweep, and
 * a border fake sweeps wrong in the last quarter of every rest.
 */
export const RestDock = memo(function RestDock(props: RestDockInput & { onSkip: () => void }) {
  const { derived, effects } = useRestDockLogic(props);
  const { t } = useT();
  const styles = useStyles(createStyles);

  return (
    <View style={[styles.dock, derived.position]} pointerEvents="box-none" onLayout={effects.layout}>
      <Row gap="md" align="center" style={styles.card}>
        <View style={styles.body}>
          <Row gap="sm" align="center">
            <Txt variant="micro" uppercase tracking={0.8} weight="700" tone="muted">
              {t('misc.rest')}
            </Txt>
            <Txt variant="monoLg" weight="700" tone="accent" style={styles.time}>
              {formatTimer(props.remainingSeconds)}
            </Txt>
          </Row>
          <View style={styles.track}>
            <View style={[styles.fill, derived.fillWidth]} />
          </View>
        </View>

        <View style={styles.adjust}>
          <IconButton
            name="minus"
            variant="surface"
            size={18}
            accessibilityLabel={t('setRow.restLess')}
            onPress={effects.less}
          />
          <IconButton
            name="plus"
            variant="surface"
            size={18}
            accessibilityLabel={t('setRow.restMore')}
            onPress={effects.more}
          />
        </View>

        <IconButton
          name="close"
          variant="plain"
          size={20}
          accessibilityLabel={t('setRow.skipRest')}
          onPress={props.onSkip}
        />
      </Row>
    </View>
  );
});
