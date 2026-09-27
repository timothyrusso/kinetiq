import { View } from 'react-native';
import { useFatalScreenLogic } from '@/features/bootstrap/ui/components/FatalScreen/FatalScreen.logic';
import { createStyles } from '@/features/bootstrap/ui/components/FatalScreen/FatalScreen.style';
import { LaunchFrame, LaunchText } from '@/features/bootstrap/ui/components/LaunchFrame/LaunchFrame';
import { Button, Row } from '@/features/core/design-system';
import { themeFor } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

const styles = createStyles(themeFor('dark'));

/**
 * The fatal screen: a launch that cannot run, a failed migration included. It uses the system
 * font, a fixed palette and no query client. The raw message is shown: on a development build it
 * is the whole diagnosis, and on a production build the sentence a support request would ask for.
 */
export function FatalScreen({
  message,
  canReset,
  onRetry,
  onReset,
}: {
  message: string;
  canReset: boolean;
  onRetry: () => void;
  onReset: () => void;
}) {
  const { state, effects } = useFatalScreenLogic(onReset);
  const { t } = useT();
  return (
    <LaunchFrame dark>
      <View style={styles.panel}>
        <LaunchText dark size="title">
          {t('boot.couldNotStart')}
        </LaunchText>
        <LaunchText dark>{t(state.resetFailed ? 'states.resetFailedBody' : 'boot.couldNotStartDetail')}</LaunchText>
        <View style={styles.messageBox}>
          <LaunchText dark muted mono>
            {message}
          </LaunchText>
        </View>
        {state.confirmingReset ? (
          <>
            <Row gap="sm" style={styles.actions}>
              <Button label={t('boot.keepMyData')} variant="secondary" size="sm" onPress={effects.keepData} />
              <Button
                label={t('boot.eraseAndStart')}
                variant="danger"
                size="sm"
                weighty
                onPress={effects.confirmReset}
              />
            </Row>
            <LaunchText dark muted>
              {t('boot.eraseWarning')}
            </LaunchText>
          </>
        ) : (
          <Row gap="sm" style={styles.actions}>
            <Button label={t('boot.tryAgain')} variant="primary" size="sm" onPress={onRetry} />
            {canReset ? (
              <Button label={t('boot.resetLocalData')} variant="ghost" size="sm" onPress={effects.askReset} />
            ) : null}
            <Button
              label={t('boot.openDeviceSettings')}
              variant="ghost"
              size="sm"
              onPress={effects.openDeviceSettings}
            />
          </Row>
        )}
      </View>
    </LaunchFrame>
  );
}
