import { ScreenHeader, SettingsList } from '@/features/core/design-system';
import { useImportPageLogic } from '@/features/transfer/ui/pages/ImportPage/ImportPage.logic';

/** The import preview. */
export function ImportPage() {
  const { derived } = useImportPageLogic();
  return (
    <>
      <ScreenHeader title={derived.title} />
      <SettingsList sections={derived.sections} />
    </>
  );
}
