import { Pressable, ScrollView, View } from 'react-native';
import {
  Badge,
  Card,
  Icon,
  MetaLine,
  NavRow,
  ProgressRing,
  Row,
  SCROLL_INSETS,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  Stack,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { AccentPreference } from '@/features/profile/ui/components/AccentPreference/AccentPreference';
import { Preference } from '@/features/profile/ui/components/Preference/Preference';
import { useProfilePageLogic } from '@/features/profile/ui/pages/ProfilePage/ProfilePage.logic';
import { createStyles } from '@/features/profile/ui/pages/ProfilePage/ProfilePage.style';

/**
 * The Profile tab. A scroll view, not a list: the content is a fixed handful of bounded cards.
 * Every link out is a row with a chevron, the identity block included: a row that navigates and
 * shows no chevron reads as a row that does nothing. Tapping the name opens the profile editor
 * as a form sheet, the way a contacts card opens its own edit form. Only the count sits inside
 * the goal ring: "this week" in there overflowed the circle, so it is the eyebrow over the
 * headline instead.
 */
export function ProfilePage() {
  const { state, derived, effects } = useProfilePageLogic();
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);

  return (
    <>
      <ScreenHeader title={t('tabs.profile')} />

      <ScrollView
        {...SCROLL_INSETS}
        contentContainerStyle={[styles.content, { paddingBottom: state.bottomSpace }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={effects.openEditor}
          accessibilityRole="button"
          accessibilityLabel={derived.displayName}
          accessibilityHint={t('profileScreen.editProfileHint')}
          style={({ pressed }) => [styles.identity, pressed ? styles.identityPressed : null]}
        >
          <Row gap="md" align="center">
            <Stack gap="xs" style={styles.fill}>
              <Txt variant="title" numberOfLines={1}>
                {derived.displayName}
              </Txt>
              <MetaLine items={derived.identity} theme={theme} wrap />
            </Stack>
            <Icon name="chevronRight" size={18} color={theme.colors.textFaint} />
          </Row>
        </Pressable>

        <View style={styles.body}>
          <Card padding="lg">
            <Row gap="lg" align="center">
              <ProgressRing progress={derived.goalProgress} theme={theme} size={86} label={derived.goalLabel} />
              <Stack gap="xs" style={styles.fill}>
                <Txt variant="micro" tone="faint" uppercase tracking={1.1}>
                  {t('profileScreen.thisWeekLabel')}
                </Txt>
                <Txt variant="subhead">{derived.goalHeadline}</Txt>
                <Txt variant="caption" tone="muted">
                  {derived.goalDetail}
                </Txt>
                {derived.bestStreakLabel !== null ? (
                  <Badge
                    label={derived.bestStreakLabel}
                    tone="warning"
                    icon={<Icon name="flame" size={12} color={theme.colors.warning} />}
                  />
                ) : null}
              </Stack>
            </Row>
          </Card>

          <SectionHeader title={t('profile.preferences')} style={styles.section} />
          <Card padding="md">
            <Stack gap="lg">
              <Preference label={t('profile.units')}>
                <SegmentedControl
                  segments={derived.unitSegments}
                  value={state.unitSystem}
                  onChange={effects.setUnits}
                />
              </Preference>
              <Preference label={t('profile.appearance')}>
                <SegmentedControl
                  segments={derived.themeSegments}
                  value={state.themeMode}
                  onChange={effects.setTheme}
                />
              </Preference>
              <Preference label={t('profile.language')}>
                <SegmentedControl
                  segments={derived.languageSegments}
                  value={state.language}
                  onChange={effects.setLanguage}
                />
              </Preference>
              <AccentPreference />
            </Stack>
          </Card>

          <SectionHeader title={t('profileScreen.app')} style={styles.section} />
          <Card padding="xxs">
            <NavRow
              title={t('profileScreen.trainingPrefs')}
              theme={theme}
              icon="target"
              topDivider={false}
              onPress={effects.openTraining}
            />
            <NavRow
              title={t('profileScreen.notifications')}
              theme={theme}
              icon="bell"
              onPress={effects.openNotifications}
            />
            <NavRow title={t('profileScreen.yourData')} theme={theme} icon="download" onPress={effects.openData} />
            <NavRow title={t('profileScreen.aboutTitle')} theme={theme} icon="info" onPress={effects.openAbout} />
          </Card>
        </View>
      </ScrollView>
    </>
  );
}
