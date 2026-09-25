/**
 * What you just did better than you have ever done it.
 *
 * Presented over Home once a session is saved. The records arrive as a route param because
 * they are the result of the finish, which has already been written: there is nothing left to
 * read them back from before the history underneath has loaded. The sheet cannot be swiped
 * away (`gestureEnabled: false` on the route); its one action closes it onto Home, where the
 * workout now tops the history.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import type { PersonalRecord } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { formatRecordValue, RECORD_LABEL } from '@/queries/useExerciseHistory';
import { useSettings } from '@/settings';
import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { FormSheet } from '@/ui/FormSheet';
import { Icon } from '@/ui/icons';
import { Row } from '@/ui/layout';
import { Txt } from '@/ui/Text';

export default function RecordsSheet() {
  const { t } = useT();
  const theme = useAppTheme();
  const units = useSettings((s) => s.unitSystem);
  const params = useLocalSearchParams<{ records?: string }>();
  const records = useMemo<PersonalRecord[]>(() => {
    try {
      const parsed: unknown = JSON.parse(params.records ?? '[]');
      return Array.isArray(parsed) ? (parsed as PersonalRecord[]) : [];
    } catch {
      return [];
    }
  }, [params.records]);

  return (
    <FormSheet
      title={
        records.length === 1 ? t('session.recordOne') : t('session.recordMany', { count: records.length })
      }
      doneLabel="session.seeInHistory"
    >
      <View style={styles.list}>
        {records.map((record) => (
          <View
            key={`${record.exerciseId}-${record.kind}`}
            style={[
              styles.record,
              {
                backgroundColor: theme.colors.accentSoft,
                borderColor: theme.colors.border,
                borderRadius: theme.surfaceSkin.radius,
              },
            ]}
          >
            <Row gap="md" align="center">
              <Icon name="trophy" size={20} color={theme.colors.accent} />
              <View style={styles.flex}>
                <Txt variant="strong" weight="700" numberOfLines={1}>
                  {record.exerciseName}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {t(RECORD_LABEL[record.kind])}
                </Txt>
              </View>
              <Txt variant="numeralSm" weight="700" tone="accent">
                {formatRecordValue(record.kind, record.value, units)}
              </Txt>
            </Row>
          </View>
        ))}
      </View>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  record: { borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
});
