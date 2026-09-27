import { View } from 'react-native';
import { LaunchFrame, LaunchText } from '@/features/bootstrap/ui/components/LaunchFrame/LaunchFrame';
import { useLaunchSurfaceLogic } from '@/features/bootstrap/ui/components/LaunchSurface/LaunchSurface.logic';
import { createStyles } from '@/features/bootstrap/ui/components/LaunchSurface/LaunchSurface.style';
import { Button, Row } from '@/features/core/design-system';
import { themeFor } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

/** Static, like the frame: the launch screens never read the theme store. */
const styles = createStyles(themeFor('dark'));

/**
 * The launch screen, and the honest escalation when the launch overruns. The copy says local
 * storage rather than "an error" because that is almost always what is at fault, and "Try again"
 * and "Reset" are the two things that can fix it from a phone.
 */
export function LaunchSurface({
  dark,
  slow,
  onRetry,
  onReset,
}: {
  dark: boolean;
  slow: boolean;
  onRetry: () => void;
  onReset: () => void;
}) {
  const { state, effects } = useLaunchSurfaceLogic(onReset);
  const { t } = useT();
  return (
    <LaunchFrame dark={dark}>
      {slow ? (
        <View style={styles.panel}>
          <LaunchText dark={dark} size="title">
            {t('boot.takingLonger')}
          </LaunchText>
          <LaunchText dark={dark}>
            {t(state.resetFailed ? 'states.resetFailedBody' : 'states.stillStartingBody')}
          </LaunchText>
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
              <LaunchText dark={dark} muted>
                {t('boot.eraseWarning')}
              </LaunchText>
            </>
          ) : (
            <Row gap="sm" style={styles.actions}>
              <Button label={t('boot.tryAgain')} variant="primary" size="sm" onPress={onRetry} />
              <Button label={t('boot.resetLocalData')} variant="ghost" size="sm" onPress={effects.askReset} />
            </Row>
          )}
        </View>
      ) : null}
    </LaunchFrame>
  );
}
