import { ScreenHeader, SettingsList } from '@/features/core/design-system';
import { useDataPageLogic } from '@/features/transfer/ui/pages/DataPage/DataPage.logic';

/** Settings: export, import and the AI recipe. */
export function DataPage() {
  const { derived } = useDataPageLogic();
  return (
    <>
      <ScreenHeader title={derived.title} largeTitle />
      <SettingsList sections={derived.sections} />
    </>
  );
}
