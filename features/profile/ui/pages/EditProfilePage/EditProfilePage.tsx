import { FormSheet, TextInput, Txt } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { useEditProfilePageLogic } from '@/features/profile/ui/pages/EditProfilePage/EditProfilePage.logic';

/** The profile editor, as a form sheet opened by tapping the name on the Profile tab. */
export function EditProfilePage() {
  const { state, derived, effects } = useEditProfilePageLogic();
  const { t } = useT();
  return (
    <FormSheet title={t('settings.you')} doneLabel="common.save" onDone={effects.save}>
      <Txt variant="caption" tone="muted">
        {t('settings.usedForEstimates')}
      </Txt>
      <TextInput
        label={t('settings.name')}
        value={state.draft.name}
        onChangeText={effects.setName}
        placeholder={t('settingsScreen.namePlaceholder')}
        maxLength={40}
        autoCapitalize="words"
        error={derived.errors.name}
      />
      <TextInput
        label={t('settings.height')}
        value={state.draft.heightCm}
        onChangeText={effects.setHeight}
        keyboardType="number-pad"
        unit="cm"
        maxLength={3}
        error={derived.errors.heightCm}
      />
      <TextInput
        label={t('settings.birthYear')}
        value={state.draft.birthYear}
        onChangeText={effects.setBirthYear}
        keyboardType="number-pad"
        maxLength={4}
        returnKeyType="done"
        onSubmitEditing={effects.save}
        error={derived.errors.birthYear}
      />
    </FormSheet>
  );
}
