import { ScreenHeader, SettingsList } from '@/features/core/design-system';
import { useTrainingSettingsPageLogic } from '@/features/profile/ui/pages/TrainingSettingsPage/TrainingSettingsPage.logic';

/** Settings: rest timer, session behaviour and the weekly goal. */
export function TrainingSettingsPage() {
  const { derived } = useTrainingSettingsPageLogic();
  return (
    <>
      <ScreenHeader title={derived.title} largeTitle />
      <SettingsList sections={derived.sections} />
    </>
  );
}
