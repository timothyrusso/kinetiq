import { memo } from 'react';
import { Stack as Column, StatTile, Txt } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { splitMetric } from '@/features/core/utils';

/**
 * One metric cell. `value: null` means unmeasured, and a caller cannot show a missing number
 * without also saying why: a dash plus a line explaining that it is normal, never a `0` or a
 * section that quietly vanishes. The unit rides beside the numeral, so a two-column grid holds a
 * value at tile size without truncating it.
 */
export const ActivityMetric = memo(function ActivityMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | null;
  note?: string;
}) {
  const { t } = useT();
  const missing = value === null;
  const parts = missing ? { value: '-' } : splitMetric(value);
  return (
    <Column gap="xxs">
      <StatTile label={label} value={parts.value} {...(parts.unit ? { unit: parts.unit } : {})} />
      {note || missing ? (
        <Txt variant="micro" tone="faint" numberOfLines={2}>
          {note ?? t('activity.notMeasured')}
        </Txt>
      ) : null}
    </Column>
  );
});
