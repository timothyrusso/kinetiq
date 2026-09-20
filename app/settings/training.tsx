/**
 * Training preferences — the settings that decide what the app *does* during a session,
 * as opposed to what it looks like or what units it prints.
 *
 * ## Why these are not on the Profile tab
 *
 * The tab carries the settings you consult: units, appearance, the weekly goal. Those are all
 * one control and all readable at a glance. These are a group you visit once and forget, and
 * adding five rows to the tab would push the history entry and the workout preferences — the
 * things actually used daily — below the fold.
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
 * chip moves the stepper, and the stepper leaving a preset value deselects the chips — one
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailScreen } from '@/ui/Screen';
import { Card, Divider, Row, SectionHeader, Stack } from '@/ui/layout';
import { Chip, SegmentedControl, Stepper, Toggle } from '@/ui/controls';
import { Txt } from '@/ui/Text';
import { useSettings, useSettingsUpdate } from '@/settings';
import { GOAL_PRESETS, REST_PRESETS } from '@/settings';
import { spacing } from '@/theme/tokens';
import { formatDurationCompact } from '@/utils/format';

/** The two readings of the same run. A string union because `Segment<T extends string>`. */
type ReadingMode = 'pace' | 'speed';

const BOTTOM_SPACE = 48;
/** The same bounds the store clamps to — see the module header. */
const REST_MIN = 15;
const REST_MAX = 600;
const GOAL_MIN = 1;
const GOAL_MAX = 14;

export default function SettingsTrainingScreen() {
  const insets = useSafeAreaInsets();
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
    <DetailScreen title="Training">
      {(topInset) => (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topInset + spacing.md, paddingBottom: BOTTOM_SPACE + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Stack gap="xxl" style={styles.body}>
            {/* --------------------------------------------------- rest timer */}
            <View>
              <SectionHeader title="Rest timer" eyebrow="Applies to new sessions" />
              <Card>
                <Stack gap="lg">
                  <Txt variant="caption" tone="muted">
                    Where a new rest countdown starts. Change it for one exercise inside a
                    routine, or skip it mid-session — this is only the default.
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
                    label="Rest after each set"
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
              <SectionHeader title="During a session" />
              <Card padding="xxs">
                <ToggleRow
                  label="Start rest automatically"
                  hint={
                    autoStartRest
                      ? 'Counting down the moment you complete a set.'
                      : 'You tap to begin resting, so a phone call between sets costs you nothing.'
                  }
                  value={autoStartRest}
                  onChange={(next) => update({ autoStartRest: next })}
                />
                <Divider inset={spacing.lg} />
                {/* Haptics live with the session behaviour they fire during rather than with
                    sound or appearance, because every haptic in this app is a set completed, a
                    rest that ended, or a record beaten. */}
                <ToggleRow
                  label="Haptics"
                  hint="Buzz on a completed set, a rest that ends, and a new record."
                  value={hapticsEnabled}
                  onChange={(next) => update({ hapticsEnabled: next })}
                />
              </Card>
              <Txt variant="micro" tone="faint" style={styles.footnote}>
                Auto-start is the option to turn off if you rest by feel: a countdown you did
                not start is a countdown you will silence.
              </Txt>
            </View>

            {/* ------------------------------------------------ cardio numbers */}
            <View>
              <SectionHeader title="Cardio numbers" />
              <Card>
                <Stack gap="md">
                  <Txt variant="strong">Pace or speed</Txt>
                  <Txt variant="caption" tone="muted">
                    {speedInsteadOfPace
                      ? 'Speed is how fast you are going — 13.3 km/h.'
                      : 'Pace is how long a kilometre takes — 4:30 /km.'}{' '}
                    The same run either way.
                  </Txt>
                  <SegmentedControl<ReadingMode>
                    value={speedInsteadOfPace ? 'speed' : 'pace'}
                    onChange={(next) => update({ showSpeedInsteadOfPace: next === 'speed' })}
                    segments={[
                      { value: 'pace', label: 'Pace', icon: 'timer' },
                      { value: 'speed', label: 'Speed', icon: 'bolt' },
                    ]}
                  />
                  <Txt variant="micro" tone="faint">
                    Applies to every pace in the app, including live during an activity.
                    Strength stays in kilograms either way.
                  </Txt>
                </Stack>
              </Card>
            </View>

            {/* --------------------------------------------------- weekly goal */}
            <View>
              <SectionHeader title="Weekly goal" eyebrow="Also on your Profile tab" />
              <Card>
                <Stack gap="lg">
                  <Txt variant="caption" tone="muted">
                    The ring on Home and the target line on Progress. Changing it never rewrites
                    history — only what counts as on target from now on.
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
                    label="Sessions per week"
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
      )}
    </DetailScreen>
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
  body: { paddingHorizontal: spacing.xl },
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
