/**
 * Cardio recording: permissions, GPS sampling, and the durable progress that
 * survives the app being killed mid-run.
 *
 * Three problems shape this file, and each is the reason for a decision that
 * would otherwise look like over-engineering.
 *
 * 1. **Distance must not be naive.** Summing haversine between consecutive GPS
 *    fixes inflates distance badly: a parked phone with 15 m of accuracy
 *    "runs" several hundred metres in ten minutes. So a fix must beat two
 *    gates to count: `accuracy <= GPS_ACCURACY_FLOOR_M`, and a segment longer
 *    than `GPS_MIN_SEGMENT_M`, which discards jitter without discarding real
 *    motion at walking pace. Both gates, and the arithmetic justifying their
 *    exact values, are in `./gps.ts`: this file only calls in and asks what a
 *    fix is worth. Fixes that fail still move the marker dot; they just don't
 *    add distance. When no fix ever passes the gates, the readout falls back to
 *    elapsed × plausible pace and says so.
 *
 * 2. **Elapsed time must not be a tick counter.** The timer adds from wall
 *    clock (`now - lastTickAt`), so a suspended or backgrounded app loses
 *    nothing, and the accumulator excludes time spent paused. The live readout
 *    derives everything from the accumulator plus the live delta rather than
 *    trusting a rendered number, so a UI that draws late is still correct.
 *
 * 3. **A recording must survive process death.** Points and totals go to SQLite
 *    on a throttled interval. On relaunch the recorder is not running but the
 *    draft is there: the resume prompt offers "you were 18 minutes in" with the
 *    route intact, not a silent loss. That recovery lives here rather than in a
 *    screen, because the screen may never be opened.
 *
 * **The simulator limitation, stated plainly.** iOS Simulator synthesises one
 * location (or a fixed debug route); it does not produce GPS. A run in the
 * simulator therefore shows the "waiting for GPS" notice and an estimated
 * distance, and that notice is the honest answer, not a bug. The degraded path
 * is the same one a denied permission or a concrete canyon takes, so it is
 * genuinely exercised code rather than a demo branch.
 */
import { Platform } from 'react-native';
import {
  Accuracy,
  getForegroundPermissionsAsync,
  hasServicesEnabledAsync,
  requestForegroundPermissionsAsync,
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync,
  watchPositionAsync,
  type LocationObject,
  type LocationPermissionResponse,
  type LocationSubscription,
} from 'expo-location';
import { defineTask } from 'expo-task-manager';
import type { ActivityKind, RoutePoint } from '@/domain/types';
import { elevationGain, haversine } from '@/utils/geometry';
import { estimateCalories, paceFromDistance } from '@/domain/logic';
import { activityRepository, readState, writeState } from '@/persistence';
import { clamp, localId } from '@/utils/functional';
import { isOfflineError } from '@/api';
import { tr } from '@/i18n/tr';
// The acceptance thresholds sit in ./gps.ts beside the arithmetic they govern, so nobody
// can read a gate without reading what it gates. Nothing here needs them as values any
// more: the only function that consulted them moved with them.
import {
  acceptedSegmentMeters,
  buildSplits,
  estimatedDistanceMeters,
  trimRoute,
} from './gps';

/** Registered task name. Must be identical in every bundle, including the headless one. */
export const CARDIO_TASK_NAME = 'kinetiq.cardio-updates';

/** Fixes worse than this are not even used to move the marker. */
const GPS_DISPLAY_ACCURACY_M = 60;
/** Points closer together than this are not stored; the route would be noise. */
const GPS_MIN_POINT_DISTANCE_M = 3;
/** How often progress is written to SQLite while recording. */
const FLUSH_INTERVAL_MS = 12_000;
/**
 * How long a recording runs before the absence of any usable fix is worth saying out loud.
 * Chosen against the flush cadence (12 s): two ticks, so the report is at most one tick late
 * and never arrives before the first fixes plausibly could.
 */
const NO_SIGNAL_GRACE_SECONDS = 25;
/**
 * How much of a crash gap counts as "you were still running". Beyond this the
 * phone was in a pocket, not on a run, and resuming the timer would invent an
 * hour of exercise.
 */
const MAX_RECOVERY_GAP_SECONDS = 45 * 60;
const DRAFT_KEY = 'cardio.draft';

export type LocationPermissionStatus =
  | 'granted'
  /** The user said no. The UI explains and offers the manual-entry path. */
  | 'denied'
  /** Not asked yet: the recorder asks when it starts. */
  | 'undetermined'
  /** iOS "Reduced accuracy" or Android "Approximate location". Distance drifts. */
  | 'reduced';

export type CardioDegradation =
  | 'permission-denied'
  | 'services-off'
  | 'no-signal'
  | 'reduced-accuracy';

/**
 * Where a recording is. Deliberately has no `finished` / `discarded`: a recording that
 * ended *is* idle, because there is nothing left to render or resume, and `finish()` and
 * `discard()` are the only writers of those outcomes. Two dead states would give the screen
 * a third thing to branch on: and since nothing ever set `idle` again, every terminal value
 * fell through to the live panel with a null draft, so "Record another" landed on a recorder
 * that had nothing running. Whether a save or a discard just happened is the *screen's*
 * business, and it already tracks that locally.
 */
export type CardioStatus = 'idle' | 'running' | 'paused';

/** The durable half of a recording: everything needed to rebuild after a kill. */
export type CardioDraft = {
  id: string;
  kind: ActivityKind;
  title: string;
  startedAt: number;
  /** Seconds of *unpaused* time as of the last write. */
  accumulatedSeconds: number;
  pausedAt: number | null;
  distanceMeters: number;
  route: RoutePoint[];
  degradedReason: string | null;
  degradations: CardioDegradation[];
  /** Set once saved or discarded, so a late write can't resurrect it. */
  finishedAt: number | null;
};

export type CardioSnapshot = {
  status: CardioStatus;
  id: string | null;
  kind: ActivityKind;
  title: string;
  startedAt: number;
  /** Derived from the wall clock; safe to render on every frame. */
  elapsedSeconds: number;
  distanceMeters: number;
  caloriesKcal: number;
  paceSecPerKm: number;
  route: RoutePoint[];
  /** Last fix used for the marker dot, accuracy permitting. */
  position: { latitude: number; longitude: number; accuracy: number } | null;
  degradations: CardioDegradation[];
  degradedReason: string | null;
  /** True when distance comes from elapsed time rather than GPS. */
  distanceEstimated: boolean;
  permission: LocationPermissionStatus;
  hydrated: boolean;
  /** A draft exists but nothing is recording: the app died mid-activity. */
  resumable: CardioDraft | null;
  lastError: string | null;
};

// ---------------------------------------------------------------------------
// Pure helpers. Device-free by design: but for the GPS maths itself, see ./gps.ts.
// ---------------------------------------------------------------------------

/**
 * Why distance is being estimated, in the user's language.
 *
 * `tr` rather than a `t` parameter: this is called from inside the recorder, several frames
 * deep in a singleton that no component owns, and threading a translator through every one of
 * those calls would put the language in the recorder's constructor, where it could not change
 * when the user changed it.
 */
export function degradationMessage(reason: CardioDegradation): string {
  switch (reason) {
    case 'permission-denied':
      return tr('cardio.degradedPermission');
    case 'services-off':
      return tr('cardio.degradedServices');
    case 'no-signal':
      return tr('cardio.degradedNoSignal');
    case 'reduced-accuracy':
      return tr('cardio.degradedAccuracy');
  }
}

export function locationPermissionErrorMessage(error: unknown): string | null {
  return tr(isOfflineError(error) ? 'cardio.errorOffline' : 'cardio.errorLocation');
}

export function defaultActivityTitle(kind: ActivityKind): string {
  return {
    run: tr('cardio.placeholderRun'),
    ride: tr('cardio.kindRide'),
    walk: tr('cardio.kindWalk'),
    yoga: tr('cardio.placeholderOther'),
    lift: tr('cardio.placeholderOther'),
  }[
    kind
  ];
}

/** `LocationPermissionResponse` reports accuracy inside platform-specific detail bags. */
function readReducedAccuracy(response: LocationPermissionResponse): boolean {
  return (
    response.ios?.accuracy === 'reduced' || response.android?.accuracy === 'coarse'
  );
}

// ---------------------------------------------------------------------------

// Defined at module scope: a headless launch must find the executor without
// ever mounting a component, so the task definition cannot live in a hook.
if (Platform.OS !== 'web') {
  defineTask(CARDIO_TASK_NAME, async ({ data }) => {
    const locations = (data as { locations?: LocationObject[] } | undefined)?.locations;
    recorder.ingestBackground(locations);
    // Returning quickly matters: a slow executor makes iOS throttle updates.
    return { processed: Array.isArray(locations) ? locations.length : 0 };
  });
}

export type StartCardioInput = { kind: ActivityKind; title?: string };

class CardioRecorder {
  private draft: CardioDraft | null = null;
  private status: CardioStatus = 'idle';
  private permission: LocationPermissionStatus = 'undetermined';
  private position: CardioSnapshot['position'] = null;
  private hydrated = false;
  private resumable: CardioDraft | null = null;
  private lastError: string | null = null;
  private watch: LocationSubscription | null = null;
  /** Last point that passed the gates: the next segment is measured from it. */
  private lastAccepted: RoutePoint | null = null;
  private lastTickAt = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private snapshot: CardioSnapshot | null = null;
  private snapshotAt = 0;
  private saving = false;

  // -- external store ------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): CardioSnapshot => {
    // Throttled and identity-stable between rebuilds: `useSyncExternalStore`
    // re-renders whenever the reference changes, and a fresh object per frame
    // would make the map refit its region 60 times a second.
    const now = Date.now();
    if (!this.snapshot || now - this.snapshotAt >= 250) {
      this.snapshot = this.build(now);
      this.snapshotAt = now;
    }
    return this.snapshot;
  };

  // -- lifecycle -----------------------------------------------------------

  /**
   * Loads an interrupted recording. Called once by bootstrap, before the splash
   * hides, so the resume prompt is on screen with the first frame.
   */
  async hydrate(): Promise<void> {
    try {
      const draft = await readState<CardioDraft | null>(DRAFT_KEY, null);
      if (!draft) {
        // nothing to do
      } else if (draft.finishedAt !== null) {
        await writeState(DRAFT_KEY, null);
      } else {
        // The process died while recording. Nothing is running now, so the
        // accumulator has to absorb the gap up to the crash: but only up to
        // the cap, because after that the phone was in a pocket, not on a run.
        const stalledSince = draft.pausedAt ?? draft.startedAt;
        const gapSeconds = draft.pausedAt
          ? 0
          : clamp((Date.now() - stalledSince) / 1000, 0, MAX_RECOVERY_GAP_SECONDS);
        this.resumable = {
          ...draft,
          accumulatedSeconds: draft.accumulatedSeconds + gapSeconds,
        };
      }
    } catch {
      // A corrupt draft must not block startup. The user loses an activity,
      // not the app.
    }
    this.hydrated = true;
    this.publish(true);
  }

  async ensurePermission(): Promise<LocationPermissionStatus> {
    try {
      const current = await getForegroundPermissionsAsync();
      if (!current.granted) {
        this.permission = current.status === 'undetermined' ? 'undetermined' : 'denied';
      } else {
        this.permission = readReducedAccuracy(current) ? 'reduced' : 'granted';
      }
    } catch {
      this.permission = 'denied';
    }
    return this.permission;
  }

  async requestPermission(): Promise<LocationPermissionStatus> {
    try {
      const asked = await requestForegroundPermissionsAsync();
      this.permission = asked.granted
        ? readReducedAccuracy(asked)
          ? 'reduced'
          : 'granted'
        : 'denied';
    } catch {
      this.permission = 'denied';
    }
    this.publish(true);
    return this.permission;
  }

  /**
   * Starts a recording. Never throws for a permission or hardware reason: a
   * denial degrades the session rather than refusing it, because the user may
   * still want a timed entry. It throws only when a recording is already live.
   */
  async start(input: StartCardioInput): Promise<CardioDraft> {
    if (this.draft && (this.status === 'running' || this.status === 'paused')) {
      throw new Error('A recording is already running.');
    }
    await this.ensurePermission();
    if (this.permission === 'undetermined') await this.requestPermission();

    const degradations: CardioDegradation[] = [];
    if (this.permission === 'denied') degradations.push('permission-denied');
    if (this.permission === 'reduced') degradations.push('reduced-accuracy');
    if (!(await this.servicesEnabled())) degradations.push('services-off');

    const now = Date.now();
    this.draft = {
      id: localId('cardio'),
      kind: input.kind,
      title: input.title?.trim() || defaultActivityTitle(input.kind),
      startedAt: now,
      accumulatedSeconds: 0,
      pausedAt: null,
      distanceMeters: 0,
      route: [],
      degradedReason: degradations.length > 0 ? degradationMessage(degradations[0]!) : null,
      degradations,
      finishedAt: null,
    };
    this.status = 'running';
    this.lastAccepted = null;
    this.lastTickAt = now;
    this.position = null;
    this.resumable = null;
    this.lastError = null;
    await this.persistDraft();
    await this.beginUpdates();
    this.beginFlushTimer();
    this.publish(true);
    return this.draft;
  }

  pause(): void {
    if (!this.draft || this.status !== 'running') return;
    this.settle();
    this.draft.pausedAt = Date.now();
    this.status = 'paused';
    void this.persistDraft();
    this.publish(true);
  }

  resume(): void {
    if (!this.draft || this.status !== 'paused') return;
    this.draft.pausedAt = null;
    this.lastTickAt = Date.now();
    this.status = 'running';
    void this.beginUpdates();
    void this.persistDraft();
    this.publish(true);
  }

  /**
   * Adopts an interrupted draft so the user can continue where they left off.
   * Route and totals carry over verbatim; only the clock restarts: and it
   * restarts paused, so they can read the summary before it starts ticking.
   */
  async recover(): Promise<void> {
    const draft = this.resumable;
    if (!draft) return;
    this.draft = { ...draft, pausedAt: Date.now(), finishedAt: null };
    this.resumable = null;
    this.status = 'paused';
    this.lastAccepted = draft.route.length > 0 ? draft.route[draft.route.length - 1]! : null;
    this.lastTickAt = Date.now();
    await this.persistDraft();
    this.beginFlushTimer();
    this.publish(true);
  }

  /** Throws away an interrupted draft without touching activity history. */
  async abandonResumable(): Promise<void> {
    this.resumable = null;
    await writeState(DRAFT_KEY, null);
    this.publish(true);
  }

  /**
   * Stops recording and writes the activity. Returns null when there is nothing
   * worth saving: the caller turns that into a "that was under 20 seconds,
   * discard?" prompt rather than silently creating junk history.
   */
  async finish(): Promise<{ activityId: string; distanceMeters: number } | null> {
    if (!this.draft || this.saving) return null;
    this.settle();
    const draft = this.draft;
    const seconds = Math.round(this.elapsedSeconds(draft, Date.now()));
    if (seconds < 20 && draft.distanceMeters < 50) {
      await this.discard();
      return null;
    }

    this.saving = true;
    try {
      const route = trimRoute(draft.route);
      const gpsBacked = draft.distanceMeters > 0;
      const distanceMeters = gpsBacked
        ? Math.round(draft.distanceMeters)
        : estimatedDistanceMeters(draft.kind, seconds);
      const activity = await activityRepository.recordCardio({
        kind: draft.kind,
        title: draft.title,
        startedAt: draft.startedAt,
        durationSeconds: seconds,
        distanceMeters,
        caloriesKcal: estimateCalories(draft.kind, seconds, { distanceMeters }),
        route,
        avgHeartRate: null,
        maxHeartRate: null,
        elevationGainMeters: elevationGain(route),
        splits: buildSplits(route),
        notes: null,
      });
      await this.stopRecording();
      await writeState(DRAFT_KEY, { ...draft, finishedAt: Date.now() } satisfies CardioDraft);
      await writeState(DRAFT_KEY, null);
      this.draft = null;
      this.status = 'idle';
      this.publish(true);
      return { activityId: activity.id, distanceMeters };
    } catch (error) {
      // A disk failure at save time is the one case where keeping everything
      // running is wrong: the user has already stopped. Leave the draft intact
      // so a retry can work, and surface why.
      this.lastError =
        error instanceof Error ? error.message : tr('cardio.errorSave');
      this.publish(true);
      throw error;
    } finally {
      this.saving = false;
    }
  }

  async discard(): Promise<void> {
    await this.stopRecording();
    this.draft = null;
    this.status = 'idle';
    this.position = null;
    await writeState(DRAFT_KEY, null);
    this.publish(true);
  }

  setKind(kind: ActivityKind): void {
    if (!this.draft) return;
    this.draft.kind = kind;
    void this.persistDraft();
    this.publish(true);
  }

  setTitle(title: string): void {
    if (!this.draft) return;
    this.draft.title = title.trim() || defaultActivityTitle(this.draft.kind);
    void this.persistDraft();
    this.publish(true);
  }

  getPermission(): LocationPermissionStatus {
    return this.permission;
  }

  /** Entry point for the headless task. */
  ingestBackground(locations: LocationObject[] | undefined): void {
    if (!Array.isArray(locations)) return;
    for (const location of locations) this.applyFix(location, 'background');
  }

  // -- sampling ------------------------------------------------------------

  /**
   * Foreground subscription. On iOS this is also the background path, * `UIBackgroundModes: location` keeps the subscription alive. Android stops
   * delivering to a JS subscription once the activity is gone, so Android also
   * registers the headless task below and both funnel into `applyFix`.
   */
  private async beginUpdates(): Promise<void> {
    await this.endWatch();
    if (this.permission === 'denied') return;
    try {
      this.watch = await watchPositionAsync(
        {
          accuracy: Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (location) => this.applyFix(location, 'foreground'),
        (error) => {
          this.lastError = locationPermissionErrorMessage(error);
          this.noteDegradation('no-signal');
          this.publish(true);
        },
      );
    } catch (error) {
      this.lastError = locationPermissionErrorMessage(error);
      this.noteDegradation('no-signal');
    }
    if (Platform.OS === 'android') await this.startAndroidBackgroundUpdates();
  }

  private async startAndroidBackgroundUpdates(): Promise<void> {
    try {
      await startLocationUpdatesAsync(CARDIO_TASK_NAME, {
        accuracy: Accuracy.High,
        timeInterval: 1500,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: 'Recording',
          notificationBody: 'Kinetiq is mapping your activity.',
          notificationColor: '#C6F24E',
        },
      });
    } catch {
      // Without the task (permission, battery optimisation, OEM denial) the
      // foreground subscription still works, so this costs background fixes
      // only. A degradation to state, not a failure to report.
      this.noteDegradation('no-signal');
    }
  }

  private applyFix(location: LocationObject, origin: 'foreground' | 'background'): void {
    const draft = this.draft;
    if (!draft || draft.pausedAt !== null) return;
    const { latitude, longitude, accuracy, altitude, speed } = location.coords;
    const point: RoutePoint = {
      t: location.timestamp ?? Date.now(),
      coords: [latitude, longitude],
      elevation: altitude ?? 0,
      heartRate: null,
    };

    if (accuracy === null || accuracy <= GPS_DISPLAY_ACCURACY_M) {
      this.position = { latitude, longitude, accuracy: accuracy ?? 0 };
    }

    const added = acceptedSegmentMeters(this.lastAccepted, {
      t: point.t,
      coords: point.coords,
      accuracy,
      speed,
    });

    if (added > 0) {
      // Store the accepted point, so the drawn polyline matches the segments the
      // totals were built from. Rejected-but-displayable fixes move the dot and
      // are deliberately not drawn.
      if (
        !this.lastAccepted ||
        haversine(this.lastAccepted.coords, point.coords) >= GPS_MIN_POINT_DISTANCE_M
      ) {
        draft.route.push(point);
      }
      draft.distanceMeters += added;
      this.lastAccepted = point;
      this.clearDegradation('no-signal');
    } else if (this.signalOverdue(draft)) {
      this.noteDegradation('no-signal');
    }

    // Background fixes arrive in a headless context that shares no timer with
    // the UI, so that path persists on its own cadence.
    if (origin === 'background') void this.persistDraft(draft);
    this.publish(false);
  }

  private async servicesEnabled(): Promise<boolean> {
    try {
      return await hasServicesEnabledAsync();
    } catch {
      // Unanswerable on some Android emulators; assume yes and let the fixes
      // themselves reveal the truth.
      return true;
    }
  }

  private noteDegradation(reason: CardioDegradation): void {
    const draft = this.draft;
    if (!draft || draft.degradations.includes(reason)) return;
    draft.degradations = [...draft.degradations, reason];
    draft.degradedReason = degradationMessage(reason);
    void this.persistDraft(draft);
    this.publish(true);
  }

  /** A GPS lock clears the "waiting for signal" notice. */
  private clearDegradation(reason: CardioDegradation): void {
    const draft = this.draft;
    if (!draft || !draft.degradations.includes(reason)) return;
    draft.degradations = draft.degradations.filter((d) => d !== reason);
    draft.degradedReason =
      draft.degradations.length > 0 ? degradationMessage(draft.degradations[0]!) : null;
    void this.persistDraft(draft);
  }

  // -- timing and persistence ---------------------------------------------

  private elapsedSeconds(draft: CardioDraft, now: number): number {
    const live = draft.pausedAt === null ? Math.max(0, (now - this.lastTickAt) / 1000) : 0;
    return draft.accumulatedSeconds + live;
  }

  /**
   * Whether a running draft has gone unreasonably long without a usable fix.
   *
   * Checked from the flush tick, not only from fix handling. The old code raised
   * `no-signal` from inside `applyFix`, which meant the case it exists to describe, * a GPS that never delivers: was the one case that could never trigger it. A phone
   * in a tunnel, a simulator with no feed, or a chip that simply stays silent produced a
   * session that estimated distance from time and *never said so*: the panel showed
   * "Waiting for a fix" forever while `degradedReason` stayed null. Same fault, two
   * different disclosures, and the louder one was unreachable.
   */
  private signalOverdue(draft: CardioDraft): boolean {
    // Only when the sky is genuinely silent. If permission is off or location
    // services are disabled, the missing fixes already have an owner, and
    // "waiting for a signal" is then a second, partly false description of the
    // same fault: nothing is being waited for, because nothing can arrive. The
    // first message is the actionable one, so it must not be doubled.
    if (draft.degradations.includes('permission-denied')) return false;
    if (draft.degradations.includes('services-off')) return false;
    return (
      draft.route.length === 0 &&
      this.elapsedSeconds(draft, Date.now()) > NO_SIGNAL_GRACE_SECONDS
    );
  }

  /** Moves the wall-clock delta into the accumulator. Call before reading totals. */
  private settle(): void {
    const draft = this.draft;
    if (!draft || draft.pausedAt !== null) return;
    const now = Date.now();
    draft.accumulatedSeconds += Math.max(0, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
  }

  private async persistDraft(draft = this.draft): Promise<void> {
    if (!draft) return;
    try {
      await writeState(DRAFT_KEY, draft);
    } catch {
      // A SQLite failure mid-run keeps recording in memory and the next flush
      // tries again. Losing a few points beats losing the interaction.
    }
  }

  private beginFlushTimer(): void {
    this.stopFlushTimer();
    this.flushTimer = setInterval(() => {
      this.settle();
      // The only place a silent GPS can be noticed, because by definition nothing
      // else is firing. Skipped while paused: a paused minute is the user stopping,
      // not the sky failing, and it must not be reported as a fault.
      if (this.draft?.pausedAt === null && this.signalOverdue(this.draft)) {
        this.noteDegradation('no-signal');
      }
      void this.persistDraft();
    }, FLUSH_INTERVAL_MS);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async endWatch(): Promise<void> {
    if (!this.watch) return;
    const sub = this.watch;
    this.watch = null;
    try {
      await sub.remove();
    } catch {
      // Already gone.
    }
  }

  private async stopRecording(): Promise<void> {
    this.settle();
    this.stopFlushTimer();
    await this.endWatch();
    if (Platform.OS === 'android') {
      try {
        await stopLocationUpdatesAsync(CARDIO_TASK_NAME);
      } catch {
        // Never started, or already stopped.
      }
    }
  }

  private build(now: number): CardioSnapshot {
    const draft = this.draft;
    const elapsed = draft ? this.elapsedSeconds(draft, now) : 0;
    const estimated = !!draft && draft.distanceMeters <= 0;
    const distance = draft
      ? estimated
        ? estimatedDistanceMeters(draft.kind, elapsed)
        : draft.distanceMeters
      : 0;
    return {
      status: this.status,
      id: draft?.id ?? null,
      kind: draft?.kind ?? this.resumable?.kind ?? 'run',
      title: draft?.title ?? this.resumable?.title ?? '',
      startedAt: draft?.startedAt ?? this.resumable?.startedAt ?? now,
      elapsedSeconds: elapsed,
      distanceMeters: distance,
      // Same helper the save path and the seeder use, so the live number is the number that
      // lands in history rather than a different model of the same run.
      caloriesKcal: estimateCalories(draft?.kind ?? 'run', elapsed, {
        distanceMeters: distance,
      }),
      paceSecPerKm: paceFromDistance(elapsed, distance),
      route: draft?.route ?? [],
      position: this.position,
      degradations: draft?.degradations ?? this.resumable?.degradations ?? [],
      degradedReason: draft?.degradedReason ?? this.resumable?.degradedReason ?? null,
      distanceEstimated: estimated,
      permission: this.permission,
      hydrated: this.hydrated,
      resumable: this.resumable,
      lastError: this.lastError,
    };
  }

  /** `immediate` bypasses the 250 ms throttle, for state changes worth a frame. */
  private publish(immediate: boolean): void {
    if (immediate) this.snapshotAt = 0;
    for (const listener of [...this.listeners]) listener();
  }
}

export const recorder = new CardioRecorder();
