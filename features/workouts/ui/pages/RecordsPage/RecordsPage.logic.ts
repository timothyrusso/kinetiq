import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { haptics } from '@/features/core/haptics';
import { useT } from '@/features/core/translations';
import { useSettings } from '@/features/settings';
import { decodeRecordsParam } from '@/features/workouts/domain/utils/recordsParam';
import { formatRecordValue, RECORD_LABEL } from '@/features/workouts/mappers/recordLabels';

/**
 * The records a finish set, from the route param: they are the result of a finish that is already
 * written, so there is nothing to read them back from before the history below has loaded.
 */
export function useRecordsPageLogic() {
  const { t } = useT();
  const units = useSettings(settings => settings.unitSystem);
  const params = useLocalSearchParams<{ records?: string }>();
  const records = useMemo(() => decodeRecordsParam(params.records), [params.records]);

  // NOTE: the record's signature plays as the sheet announcing it appears; the finish itself stays
  // silent when there is a record.
  useEffect(() => {
    if (records.length > 0) haptics.personalRecord();
  }, [records.length]);

  const rows = useMemo(
    () =>
      records.map(record => ({
        key: `${record.exerciseId}-${record.kind}`,
        name: record.exerciseName,
        label: t(RECORD_LABEL[record.kind]),
        value: formatRecordValue(record.kind, record.value, units),
      })),
    [records, t, units],
  );

  return {
    derived: {
      title: records.length === 1 ? t('session.recordOne') : t('session.recordMany', { count: records.length }),
      rows,
    },
  };
}
