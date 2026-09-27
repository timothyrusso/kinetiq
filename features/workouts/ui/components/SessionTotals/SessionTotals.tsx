import { memo } from 'react';
import { Row, StatTile } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { compactNumber, formatDurationCompact, type UnitSystem, weightUnit, weightValue } from '@/features/core/utils';

/**
 * Elapsed, sets and volume: the three numbers someone asks for afterwards. Three abreast, so the
 * compact numeral: the default one truncates "1h 05m" on a phone.
 */
export const SessionTotals = memo(function SessionTotals({
  elapsed,
  sets,
  planned,
  volumeKg,
  units,
}: {
  elapsed: number;
  sets: number;
  planned: number;
  volumeKg: number;
  units: UnitSystem;
}) {
  const { t } = useT();
  return (
    <Row gap="lg" align="start">
      <StatTile label={t('session.elapsed')} value={formatDurationCompact(elapsed)} emphasis="compact" tabular />
      <StatTile label={t('session.sets')} value={`${sets}/${planned}`} emphasis="compact" tabular />
      <StatTile
        label={t('session.volumeIn', { unit: weightUnit(units) })}
        value={compactNumber(weightValue(volumeKg, units))}
        emphasis="compact"
        tabular
      />
    </Row>
  );
});
