/**
 * Training preferences: the settings that decide what the app *does* during a session,
 * as opposed to what it looks like or what units it prints.
 *
 * ## Why these are not on the Profile tab
 *
 * The tab carries the settings you consult: units, appearance, the weekly goal. Those are all
 * one control and all readable at a glance. These are a group you visit once and forget, and
 * adding five rows to the tab would push the history entry and the workout preferences: the
 * things actually used daily: below the fold.
 *
 * ## No Save button, anywhere in this group
 *
 * Each control commits the moment it changes, straight into the store, which debounces its
 * write to the database. That is safe because no control here accepts partial input: a toggle,
 * a chip, a stepper and a segmented control can only ever be in a valid position. (The profile
 * form on the hub screen does have a Save, and its header says why text fields are the
 * exception.) The bounds passed to each stepper are the same ones `normaliseSettings` clamps
 * to, so the UI can never offer a value that the store would quietly rewrite.
 *
 * ## Presets *and* a stepper for the same number
 *
 * Rest time gets both. The chips are the four answers that cover most people and can be hit
 * with a thumb while carrying a dumbbell; the stepper exists because "75 seconds" is a real
 * choice and a preset list is not allowed to be the only legal set of answers. Selecting a
 * chip moves the stepper, and the stepper leaving a preset value deselects the chips: one
 * source of truth, two ways to reach it.
 *
 * ## Pace versus speed is a segmented control, not a switch
 *
 * Two named options. A switch would show an empty circle where a word belongs, and the whole
 * point of this setting is that which word you want is a preference about how you read numbers,
 * not a thing you want on or off.
 */
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useScreenContentBottom } from '@/ui/insets';

import { ScreenHeader } from '@/ui/Screen';
import { Card, Divider, Row, SectionHeader, Stack } from '@/ui/layout';
import { Chip, SegmentedControl, Stepper, Toggle } from '@/ui/controls';
import { Txt } from '@/ui/Text';
import { useSettings, useSettingsUpdate } from '@/settings';
import { GOAL_PRESETS, REST_PRESETS } from '@/settings';
import { spacing, screenGutter } from '@/theme/tokens';
import { formatDurationCompact } from '@/utils/format';
import { useT } from '@/i18n/useT';

/** The two readings of the same run. A string union because `Segment<T extends string>`. */
type ReadingMode = 'pace' | 'speed';

/** The same bounds the store clamps to: see the module header. */
const REST_MIN = 15;
const REST_MAX = 600;
const GOAL_MIN = 1;
const GOAL_MAX = 14;

export default function SettingsTrainingScreen() {
  const { t } = useT();
  const bottomSpace = useScreenContentBottom();
  const update = useSettingsUpdate();

  const rest = useSettings((s) => s.defaultRestSeconds);
  const autoStartRest = useSettings((s) => s.autoStartRest);
  const hapticsEnabled = useSettings((s) => s.hapticsEnabled);
  const goal = useSettings((s) => s.weeklyGoalWorkouts);
  const speedInsteadOfPace = useSettings((s) => s.showSpeedInsteadOfPace);

  const setRest = useCallback(
    (seconds: number) => update({ defaultRestSeconds: seconds }),
    [update],
  );

  return (
    <>
      <ScreenHeader title={t('trainingPrefs.title')} largeTitle />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.md, paddingBottom: bottomSpace },
        ]}
        // `automatic`, so iOS owns the inset under the large title and can collapse it as
        // this view scrolls. Without it the title stays large forever and the screen looks
        // like a native header that does not work.
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Stack gap="xxl" style={styles.body}>
          {/* --------------------------------------------------- rest timer */}
          <View>
            <SectionHeader
              title={t('trainingPrefs.restTimer')}
              eyebrow={t('trainingPrefs.appliesToNew')}
            />
            <Card>
              <Stack gap="lg">
                <Txt variant="caption" tone="muted">
                  {t('misc.restDefaultBody')}
                </Txt>

                <Row gap="sm" style={styles.chips}>
                  {REST_PRESETS.map((seconds) => (
                    <Chip
                      key={seconds}
                      label={`${seconds}s`}
                      selected={seconds === rest}
                      onPress={() => setRest(seconds)}
                    />
                  ))}
                </Row>

                <Stepper
                  label={t('trainingPrefs.restAfterSet')}
                  value={rest}
                  min={REST_MIN}
                  max={REST_MAX}
                  step={5}
                  suffix="s"
                  onChange={setRest}
                />
                <Txt variant="micro" tone="faint">
                  {formatDurationCompact(rest)} of recovery between sets.
                </Txt>
              </Stack>
            </Card>
          </View>

          {/* --------------------------------------------- during a session */}
          <View>
            <SectionHeader title={t('trainingPrefs.duringSession')} />
            <Card padding="xxs">
              <ToggleRow
                label={t('trainingPrefs.autoStartRest')}
                hint={
                  autoStartRest
                    ? t('states.autoStartOn')
                    : t('states.autoStartOff')
                }
                value={autoStartRest}
                onChange={(next) => update({ autoStartRest: next })}
              />
              <Divider inset={spacing.lg} />
              {/* Haptics live with the session behaviour they fire during rather than with
                  sound or appearance, because every haptic in this app is a set completed, a
                  rest that ended, or a record beaten. */}
              <ToggleRow
                label={t('trainingPrefs.haptics')}
                hint="Buzz on a completed set, a rest that ends, and a new record."
                value={hapticsEnabled}
                onChange={(next) => update({ hapticsEnabled: next })}
              />
            </Card>
            <Txt variant="micro" tone="faint" style={styles.footnote}>
              {t('misc.autoStartFootnote')}
            </Txt>
          </View>

          {/* ------------------------------------------------ cardio numbers */}
          <View>
            <SectionHeader title={t('trainingPrefs.cardioNumbers')} />
            <Card>
              <Stack gap="md">
                <Txt variant="strong">{t('trainingPrefs.paceOrSpeed')}</Txt>
                <Txt variant="caption" tone="muted">
                  {t(speedInsteadOfPace ? 'states.speedExample' : 'states.paceExample')}{' '}
                  {t('states.sameRunEither')}
                </Txt>
                <SegmentedControl<ReadingMode>
                  value={speedInsteadOfPace ? 'speed' : 'pace'}
                  onChange={(next) => update({ showSpeedInsteadOfPace: next === 'speed' })}
                  segments={[
                    { value: 'pace', label: t('cardio.pace'), icon: 'timer' },
                    { value: 'speed', label: t('cardio.speed'), icon: 'bolt' },
                  ]}
                />
                <Txt variant="micro" tone="faint">
                  {t('misc.paceAppliesBody')}
                </Txt>
              </Stack>
            </Card>
          </View>

          {/* --------------------------------------------------- weekly goal */}
          <View>
            <SectionHeader
              title={t('trainingPrefs.weeklyGoal')}
              eyebrow={t('trainingPrefs.alsoOnProfile')}
            />
            <Card>
              <Stack gap="lg">
                <Txt variant="caption" tone="muted">
                  {t('misc.goalBody')}
                </Txt>
                <Row gap="sm" style={styles.chips}>
                  {GOAL_PRESETS.map((n) => (
                    <Chip
                      key={n}
                      label={`${n}×`}
                      selected={n === goal}
                      onPress={() => update({ weeklyGoalWorkouts: n })}
                    />
                  ))}
                </Row>
                <Stepper
                  label={t('trainingPrefs.sessionsPerWeek')}
                  value={goal}
                  min={GOAL_MIN}
                  max={GOAL_MAX}
                  onChange={(next) => update({ weeklyGoalWorkouts: next })}
                />
              </Stack>
            </Card>
          </View>
        </Stack>
      </ScrollView>
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

/**
 * Label plus a switch, inside a card that has already done the rounding and the padding.
 *
 * The hint is part of the row rather than a separate paragraph because these hints change
 * meaning with the switch: "Counting down the moment you complete a set" becomes "You tap to
 * begin resting". A hint that describes the state you are *in* is what tells you what flipping
 * it will cost.
 */
function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Stack gap="xxs" style={styles.toggleText}>
        <Txt variant="strong">{label}</Txt>
        <Txt variant="caption" tone="muted">
          {hint}
        </Txt>
      </Stack>
      <Toggle value={value} onChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: screenGutter },
  chips: { flexWrap: 'wrap' },
  footnote: { marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toggleText: { flex: 1 },
});
