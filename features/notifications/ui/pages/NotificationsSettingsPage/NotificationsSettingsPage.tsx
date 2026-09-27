import { View } from 'react-native';
import { ScreenHeader, SettingsList, useStyles } from '@/features/core/design-system';
import { useNotificationsSettingsPageLogic } from '@/features/notifications/ui/pages/NotificationsSettingsPage/NotificationsSettingsPage.logic';
import { createStyles } from '@/features/notifications/ui/pages/NotificationsSettingsPage/NotificationsSettingsPage.style';

/** Settings: the rest-timer alert, the weekly reminder and the system permission. */
export function NotificationsSettingsPage() {
  const { derived } = useNotificationsSettingsPageLogic();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.root}>
      <ScreenHeader title={derived.title} largeTitle />
      <SettingsList sections={derived.sections} />
    </View>
  );
}
