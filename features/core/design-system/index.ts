import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { usePulse } from '@/features/core/design-system/animation/animation';
export { HeatmapCalendar, type HeatmapDay } from '@/features/core/design-system/charts/HeatmapCalendar';
export { LineChart, type LinePoint } from '@/features/core/design-system/charts/LineChart';
export { ProgressRing } from '@/features/core/design-system/charts/ProgressRing';
export { Button } from '@/features/core/design-system/controls/Button';
export { Chip } from '@/features/core/design-system/controls/Chip';
export { ConfirmDialog } from '@/features/core/design-system/controls/ConfirmDialog';
export {
  ContentUnavailable,
  type ContentUnavailableAction,
} from '@/features/core/design-system/controls/ContentUnavailable';
export { IconButton } from '@/features/core/design-system/controls/IconButton';
export { SegmentedControl } from '@/features/core/design-system/controls/SegmentedControl';
export {
  SettingsList,
  type SettingsRow,
  type SettingsSection,
} from '@/features/core/design-system/controls/SettingsList';
export { Stepper } from '@/features/core/design-system/controls/Stepper';
export { TextInput } from '@/features/core/design-system/controls/TextInput';
export { ActionRow } from '@/features/core/design-system/display/ActionRow';
export { ACTIVITY_ICON } from '@/features/core/design-system/display/activityIcon';
export { Badge } from '@/features/core/design-system/display/Badge';
export { ExerciseRow } from '@/features/core/design-system/display/ExerciseRow';
export { ExerciseThumb } from '@/features/core/design-system/display/ExerciseThumb';
export { exerciseTags } from '@/features/core/design-system/display/exerciseTags';
export { illustrationBackdrop } from '@/features/core/design-system/display/exerciseThumbTile';
export { EXERCISE_IMAGE_CACHE } from '@/features/core/design-system/display/imageCache';
export { ListRow } from '@/features/core/design-system/display/ListRow';
export { MetaLine } from '@/features/core/design-system/display/MetaLine';
export { NavRow } from '@/features/core/design-system/display/NavRow';
export { RoutineRow } from '@/features/core/design-system/display/RoutineRow';
export { SectionHeader } from '@/features/core/design-system/display/SectionHeader';
export { StatTile } from '@/features/core/design-system/display/StatTile';
export { SwipeToDelete } from '@/features/core/design-system/display/SwipeToDelete';
export { TagRow } from '@/features/core/design-system/display/TagRow';
export type { MetaItem, Tag } from '@/features/core/design-system/display/types';
export { ICON_SIZE, Icon, type IconName, IconTile } from '@/features/core/design-system/icons/icons';
export {
  type MaterialIconName,
  materialIcon,
  prefetchMaterialIcons,
} from '@/features/core/design-system/icons/materialIcons';
export { Card } from '@/features/core/design-system/layout/Card';
export { Divider } from '@/features/core/design-system/layout/Divider';
export { closeSheet, FormFooter, FormSection, FormSheet } from '@/features/core/design-system/layout/FormSheet';
export { Gap } from '@/features/core/design-system/layout/Gap';
export {
  useScreenContentBottom,
  useTabContentBottom,
  useTransparentHeaderInset,
} from '@/features/core/design-system/layout/insets';
export { KeyboardAvoid } from '@/features/core/design-system/layout/KeyboardAvoid';
export { MetricGrid } from '@/features/core/design-system/layout/MetricGrid';
export { OverlaySurface } from '@/features/core/design-system/layout/OverlaySurface';
export { Rail } from '@/features/core/design-system/layout/Rail';
export { Row } from '@/features/core/design-system/layout/Row';
export { SCROLL_INSETS, ScreenHeader } from '@/features/core/design-system/layout/Screen';
export { Stack } from '@/features/core/design-system/layout/Stack';
export { RouteErrorScreen } from '@/features/core/design-system/states/RouteErrorScreen';
export { SplashCover } from '@/features/core/design-system/states/SplashCover';
export {
  EmptyState,
  ErrorState,
  SkeletonCard,
  SkeletonList,
  ThemedRefreshControl,
} from '@/features/core/design-system/states/states';
export { type StyleFactory, useStyles } from '@/features/core/design-system/styles/useStyles';
export { CellText } from '@/features/core/design-system/text/CellText';
export { MetricLabel, Txt } from '@/features/core/design-system/text/Text';
