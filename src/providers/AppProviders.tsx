/**
 * Root providers: bootstrap gate, query client, app lifecycle.
 *
 * ## Why bootstrap gates rendering instead of running alongside it
 *
 * The alternative — mount the navigator and let each screen await what it needs —
 * is what most RN apps do, and it is why they flash default-font text for 300ms,
 * render the light theme for one frame of a dark-mode launch, and let a screen mount
 * against a closed database. It also hides the worst failure behind a spinner that
 * eventually resolves into an error boundary nobody designed.
 *
 * So this component renders exactly one of four things: the launch screen, the
 * "still starting" state, the fatal state, or the app. Nothing below can assume any
 * of those outcomes, because by the time it mounts the database is open, migrations
 * have run, settings are in the store, fonts are loaded, an interrupted workout has
 * been restored and the exercise provider is configured.
 *
 * ## Two things deliberately *not* done here
 *
 * **No context for the outcome.** The query client owns remote state; the settings
 * and session stores own the rest. A context carrying bootstrap data would exist to
 * be read in two places (the settings diagnostics row, the dev inspector) and would
 * re-render everything it touched whenever it did. `getBootstrapOutcome()` is the
 * same information without the subscription.
 *
 * **No auto-recovery from a slow start.** Past the deadline the app stays on the
 * launch screen and says so, offering a retry and an explicit, confirm-gated data
 * reset. Rendering the real app with a closed database would trade one dead screen
 * for a dozen screens each throwing their own "Database accessed before
 * openDatabase() resolved" — strictly harder to diagnose, and not something the user
 * can act on from a phone.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { clearAllUserData } from '@/persistence';
import { getQueryClient } from '@/query/client';
import { haptics } from '@/services/haptics';
import { themeFor, useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Text';
import { Card, Divider, Row } from '@/ui/layout';

import {
  BOOTSTRAP_DEADLINE_MS,
  createSplashController,
  installAppLifecycle,
  runBootstrap,
  useSystemDark,
  type BootstrapOutcome,
} from './bootstrap';

/**
 * Held outside React on purpose: this has to be readable from non-component code
 * (the settings screen's diagnostics row, the dev inspector) and has to survive a
 * Fast Refresh remount without re-running a migration.
 */
let settled: BootstrapOutcome | null = null;
let inFlight: Promise<BootstrapOutcome> | null = null;

export function getBootstrapOutcome(): BootstrapOutcome | null {
  return settled;
}

/**
 * Idempotent by design. React runs effects twice in the development build, and a
 * migration must not run twice; `seedIfEmpty` is guarded by its own row count, but
 * re-opening the database and re-registering the notification handler for nothing is
 * still a way to make a startup race look intermittent.
 */
function startOnce(systemDark: boolean): Promise<BootstrapOutcome> {
  if (!inFlight) {
    inFlight = runBootstrap(systemDark)
      .then((outcome) => {
        settled = outcome;
        return outcome;
      })
      .catch((error: unknown) => {
        // Cleared so "Try again" actually retries instead of re-resolving the same
        // rejection forever.
        inFlight = null;
        throw error;
      });
  }
  return inFlight;
}

const splash = createSplashController();

/**
 * Called at module scope, not in an effect. The native splash is torn down the moment
 * React's first frame lands, and an effect runs *after* commit — by which point the
 * handoff has already happened and the frame it was meant to protect has already
 * flashed. This is the only module-level side effect in the app, and it is the one
 * thing that genuinely has to be one.
 */
splash.preventAutoHide();

type Phase = 'starting' | 'slow' | 'ready' | 'failed';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const systemDark = useSystemDark();
  const [phase, setPhase] = useState<Phase>(settled ? 'ready' : 'starting');
  const [failure, setFailure] = useState<unknown>(null);
  const settledRef = useRef(settled !== null);

  const attempt = useCallback(() => {
    setFailure(null);
    setPhase('starting');
    startOnce(systemDark)
      .then(() => setPhase('ready'))
      .catch((error: unknown) => {
        setFailure(error);
        setPhase('failed');
      })
      .finally(() => splash.hide());
  }, [systemDark]);

  useEffect(() => {
    if (settledRef.current) {
      splash.hide();
      return;
    }
    attempt();
    // A slow start is its own visible state rather than an infinite spinner: past the
    // deadline the user gets the two controls that can fix it.
    const deadline = setTimeout(() => {
      if (!settledRef.current) setPhase((current) => (current === 'starting' ? 'slow' : current));
    }, BOOTSTRAP_DEADLINE_MS);
    return () => clearTimeout(deadline);
  }, [attempt]);

  // The AppState subscription lives here rather than in the root layout so it attaches
  // exactly once, above the navigator, and cannot be torn down by a stack change —
  // the workout clock depends on seeing every background transition.
  useEffect(() => installAppLifecycle(), []);

  if (phase === 'ready') {
    return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
  }

  // Note the query provider is intentionally *below* this gate on the success path but
  // absent on the failure paths: the fatal screen must not need a working cache, and a
  // screen that could query would be a screen that could query a closed database.
  if (phase === 'failed') return <FatalScreen error={failure} onRetry={attempt} />;

  return <LaunchSurface dark={systemDark} slow={phase === 'slow'} onRetry={attempt} />;
}

/* -------------------------------------------------------------- launch UI -- */

/**
 * The launch screen, plus the honest escalation when bootstrap overruns.
 *
 * The copy says *local storage* rather than "an error" because that is what is almost
 * always at fault: a blocked or unreadable database is by far the likeliest way to
 * hang past the deadline, and "Try again" and "Reset" are the two things that can
 * actually fix it from a phone. `BootFailure` is surfaced verbatim by the fatal screen
 * once a retry fails outright, so this screen stays short.
 */
function LaunchSurface({ dark, slow, onRetry }: { dark: boolean; slow: boolean; onRetry: () => void }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);

  const handleReset = useCallback(async () => {
    setResetFailed(false);
    try {
      // Best-effort: if the database never opened there is nothing to clear, and the
      // retry will hit the same underlying problem — which the fatal screen will then
      // name with the real message instead of this generic one.
      await clearAllUserData();
    } catch {
      setResetFailed(true);
    }
    setConfirmingReset(false);
    inFlight = null;
    onRetry();
  }, [onRetry]);

  return (
    <LaunchFrame dark={dark}>
      {slow ? (
        <View style={styles.panel}>
          <LaunchText dark={dark} size="title">
            Taking longer than expected
          </LaunchText>
          <LaunchText dark={dark}>
            {resetFailed
              ? 'Kinetiq still could not open local storage, and clearing it did not help. Reinstalling the app is the remaining option; your data has already been removed.'
              : 'Kinetiq is still starting up. This usually means local storage is busy or was left in a state it cannot read.'}
          </LaunchText>
          {confirmingReset ? (
            <>
              <Row gap="sm" style={styles.actions}>
                <Button label="Keep my data" variant="secondary" size="sm" onPress={() => setConfirmingReset(false)} />
                <Button
                  label="Erase and start over"
                  variant="danger"
                  size="sm"
                  weighty
                  onPress={() => void handleReset()}
                />
              </Row>
              <LaunchText dark={dark} muted>
                Erasing removes your history, routines and settings. It cannot be undone.
              </LaunchText>
            </>
          ) : (
            <Row gap="sm" style={styles.actions}>
              <Button label="Try again" variant="primary" size="sm" onPress={onRetry} />
              <Button
                label="Reset local data"
                variant="ghost"
                size="sm"
                onPress={() => {
                  haptics.warning();
                  setConfirmingReset(true);
                }}
              />
            </Row>
          )}
        </View>
      ) : null}
    </LaunchFrame>
  );
}

/**
 * The fatal screen.
 *
 * Deliberately uses the system font, a hard-coded palette and no theme or query
 * provider: the thing that failed might *be* the font loader or the settings store,
 * and an error screen that depends on the system that broke is the most reliably
 * annoying failure mode in app design. The raw message is shown because on a dev build
 * it is the whole diagnosis, and on a production build it is the sentence a support
 * request would otherwise have to ask for.
 */
function FatalScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);

  return (
    <LaunchFrame dark>
      <View style={styles.panel}>
        <LaunchText dark size="title">
          Kinetiq could not start
        </LaunchText>
        <LaunchText dark>
          Something failed before the app could open its local storage. Your data has not been changed.
        </LaunchText>
        <View style={styles.messageBox}>
          <LaunchText dark muted mono>
            {message.slice(0, 400)}
          </LaunchText>
        </View>
        <Row gap="sm" style={styles.actions}>
          <Button label="Try again" variant="primary" size="sm" onPress={onRetry} />
          <Button
            label="Open device settings"
            variant="ghost"
            size="sm"
            onPress={() => {
              // Storage-permission problems and a full disk both surface here, and
              // both are fixed outside the app.
              void Linking.openSettings().catch(() => undefined);
            }}
          />
        </Row>
      </View>
    </LaunchFrame>
  );
}

/* ------------------------------------------------------------------- pieces -- */

/**
 * Matches the native splash exactly — `themeFor` is the only source for the launch
 * colour, so app.json, this frame and the first rendered screen cannot disagree.
 */
function LaunchFrame({ dark, children }: { dark: boolean; children?: React.ReactNode }) {
  const theme = themeFor(dark ? 'dark' : 'light');
  return (
    <View style={[styles.frame, { backgroundColor: theme.brandBackground }]}>
      <View style={styles.mark}>
        <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
        <LaunchText dark={dark} size="brand">
          KINETIQ
        </LaunchText>
      </View>
      {children}
    </View>
  );
}

/**
 * Plain RN text, not `Txt`: fonts are the thing that may still be loading, or may have
 * failed outright, and `Txt` resolves its size through the custom font families.
 */
function LaunchText({
  children,
  dark,
  size = 'body',
  muted,
  mono,
}: {
  children: string;
  dark: boolean;
  size?: 'brand' | 'title' | 'body';
  muted?: boolean;
  mono?: boolean;
}) {
  const theme = themeFor(dark ? 'dark' : 'light');
  const color = muted ? theme.colors.textMuted : theme.colors.text;
  return (
    <Text
      style={[
        styles.text,
        size === 'title' ? styles.textTitle : null,
        size === 'brand' ? styles.textBrand : null,
        { color },
        mono ? styles.textMono : null,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  mark: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxxl },
  dot: { width: 14, height: 14, borderRadius: 7 },
  panel: { width: '100%', maxWidth: 380, gap: spacing.sm, alignItems: 'flex-start' },
  actions: { marginTop: spacing.xs, flexWrap: 'wrap' },
  messageBox: {
    alignSelf: 'stretch',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#212B3F',
    backgroundColor: '#0B0F18',
    padding: spacing.sm,
  },
  text: { fontSize: 15, lineHeight: 22, letterSpacing: 0.1, textAlign: 'left' },
  textTitle: { fontSize: 19, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  textBrand: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: 4.2 },
  textMono: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  diagRow: { paddingVertical: spacing.sm },
});

/* ------------------------------------------------------------- diagnostics -- */

/**
 * Dev/settings readout of what bootstrap actually did — schema version moved, whether
 * this was a first run, whether a workout was restored.
 *
 * It exists because "the app lost my workout" is unanswerable without it. Everything
 * here is a fact bootstrap observed, not a guess the UI reconstructed.
 */
export function BootstrapDiagnostics() {
  const theme = useAppTheme();
  const outcome = getBootstrapOutcome();
  if (!outcome) return null;

  const { database, seeded, resumedWorkout, migrationFailed } = outcome;
  const rows: ReadonlyArray<{ label: string; value: string; danger?: boolean }> = [
    {
      label: 'Schema',
      value: migrationFailed
        ? `Migration failed at v${database.fromVersion}`
        : `v${database.fromVersion} → v${database.toVersion}`,
      danger: migrationFailed,
    },
    {
      label: 'First run',
      value: seeded ? `${seeded.activities} activities, ${seeded.routines} routines seeded` : 'Existing database',
    },
    {
      label: 'Session restore',
      value: resumedWorkout ? 'Restored a paused workout' : 'Nothing to restore',
    },
  ];

  return (
    <Card padding="md">
      {rows.map((row, index) => (
        <View key={row.label}>
          {index > 0 ? <Divider /> : null}
          <Row gap="md" justify="between" style={styles.diagRow}>
            <Txt variant="caption" tone="muted">
              {row.label}
            </Txt>
            <Txt variant="caption" color={row.danger ? theme.colors.danger : theme.colors.textFaint} align="right">
              {row.value}
            </Txt>
          </Row>
        </View>
      ))}
    </Card>
  );
}
