import { ConfirmDialog, ScreenHeader, SettingsList } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { useAboutPageLogic } from '@/features/profile/ui/pages/AboutPage/AboutPage.logic';

/** About: the build, the exercise catalog's source, what is on this device, and the erase. */
export function AboutPage() {
  const { state, derived, effects } = useAboutPageLogic();
  const { t } = useT();
  return (
    <>
      <ScreenHeader title={derived.title} largeTitle />
      <SettingsList sections={derived.sections} />
      {state.confirming ? (
        <ConfirmDialog
          visible={!state.erasing}
          title={t('about.eraseTitle')}
          message={derived.eraseMessage}
          confirmLabel={t('about.eraseConfirm')}
          cancelLabel={t('about.keepMyData')}
          destructive
          onConfirm={effects.confirmErase}
          onCancel={effects.keep}
        />
      ) : null}
    </>
  );
}
