import { View } from 'react-native';
import { FormSheet, Icon, Row, Txt, useStyles } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useRecordsPageLogic } from '@/features/workouts/ui/pages/RecordsPage/RecordsPage.logic';
import { createStyles } from '@/features/workouts/ui/pages/RecordsPage/RecordsPage.style';

/**
 * What you just did better than you have ever done it, presented over Home once a workout is
 * saved. Its one action, like a swipe, closes it onto Home, where the workout now tops the history.
 */
export function RecordsPage() {
  const { derived } = useRecordsPageLogic();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);
  return (
    <FormSheet title={derived.title}>
      <View style={styles.list}>
        {derived.rows.map(row => (
          <View key={row.key} style={styles.record}>
            <Row gap="md" align="center">
              <Icon name="trophy" size={20} color={theme.colors.accent} />
              <View style={styles.flex}>
                <Txt variant="strong" weight="700" numberOfLines={1}>
                  {row.name}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {row.label}
                </Txt>
              </View>
              <Txt variant="numeralSm" weight="700" tone="accent">
                {row.value}
              </Txt>
            </Row>
          </View>
        ))}
      </View>
    </FormSheet>
  );
}
