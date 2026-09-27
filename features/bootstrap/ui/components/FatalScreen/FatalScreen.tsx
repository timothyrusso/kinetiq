import { Linking, View } from 'react-native';
import { createStyles } from '@/features/bootstrap/ui/components/FatalScreen/FatalScreen.style';
import { LaunchFrame, LaunchText } from '@/features/bootstrap/ui/components/LaunchFrame/LaunchFrame';
import { Button, Row } from '@/features/core/design-system';
import { themeFor } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

const styles = createStyles(themeFor('dark'));

/** Storage-permission problems and a full disk both surface here, and both are fixed outside the app. */
const openDeviceSettings = () => {
  void Linking.openSettings().catch(() => undefined);
};

/**
 * The fatal screen: a launch that cannot run, a failed migration included. It uses the system
 * font, a fixed palette and no query client. The raw message is shown: on a development build it
 * is the whole diagnosis, and on a production build the sentence a support request would ask for.
 */
export function FatalScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useT();
  return (
    <LaunchFrame dark>
      <View style={styles.panel}>
        <LaunchText dark size="title">
          {t('boot.couldNotStart')}
        </LaunchText>
        <LaunchText dark>{t('boot.couldNotStartDetail')}</LaunchText>
        <View style={styles.messageBox}>
          <LaunchText dark muted mono>
            {message}
          </LaunchText>
        </View>
        <Row gap="sm" style={styles.actions}>
          <Button label={t('boot.tryAgain')} variant="primary" size="sm" onPress={onRetry} />
          <Button label={t('boot.openDeviceSettings')} variant="ghost" size="sm" onPress={openDeviceSettings} />
        </Row>
      </View>
    </LaunchFrame>
  );
}
