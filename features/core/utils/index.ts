import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { withAlpha } from '@/features/core/utils/color';
export {
  addDays,
  compactNumber,
  formatDuration,
  formatDurationCompact,
  formatTimer,
  formatWeight,
  joinMiddleDot,
  parseNumber,
  repsFromRange,
  splitMetric,
  startOfDay,
  startOfWeek,
  trimNumber,
  type UnitSystem,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
  weightValue,
} from '@/features/core/utils/format';
export { clamp, localId, moveItem, sum } from '@/features/core/utils/functional';
export {
  agoLabel,
  formatAgoLocalized,
  formatClock,
  formatShortDateLocalized,
  fullDateLabel,
  shortDateLabel,
  timeOfDayLabel,
  weekHeading,
} from '@/features/core/utils/relativeTime';
export { useDebouncedValue, useIsSettling } from '@/features/core/utils/useDebouncedValue';
