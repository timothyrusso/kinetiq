/**
 * Cardio recording: permissions, GPS sampling, and the durable progress that
 * survives the app being killed mid-run.
 *
 * Three problems shape this file, and each is the reason for a decision that
 * would otherwise look like over-engineering.
 *
 * 1. **Distance must not be naive.** Summing haversine between consecutive GPS
 *    fixes inflates distance badly — a parked phone with 15 m of accuracy
 *    "runs" several hundred metres in ten minutes. So a fix must beat two
 *    gates to count: `accuracy <= GPS_ACCURACY_FLOOR_M`, and a segment longer
 *    than `GPS_MIN_SEGMENT_M`, which discards jitter without discarding real
 *    motion at walking pace (see the constant for the arithmetic). Fixes that
 *    fail still move the marker dot; they just don't add distance. When no fix
 *    ever passes the gates, the readout falls back to elapsed × plausible pace
 *    and says so.
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
import type { ActivityKind, ActivitySplit, LatLng, RoutePoint } from '@/domain/types';
import { elevationGain, haversine, resampleRoute, splitRouteByDistance } from '@/utils/geometry';
import { caloriesRate, paceFromDistance } from '@/domain/logic';
import { activityRepository, readState, writeState } from '@/persistence';
import { clamp, localId, mean } from '@/utils/functional';
import { isOfflineError } from '@/api';

/** Registered task name. Must be identical in every bundle, including the headless one. */
export const CARDIO_TASK_NAME = 'kinetiq.cardio-updates';

/** A fix must be this good (or better) before it contributes distance. */
export const GPS_ACCURACY_FLOOR_M = 24;
/**
 * Segments below this are GPS jitter. 4 m at ~2 samples/second is 8 m/s — well
 * above any human pace — so real motion passes and wobble does not. Below ~0.8
 * m/s (a slow walk) some segments get skipped, which under-reads distance by a
 * few percent; that is the correct trade, because the failure mode of a lower
 * floor is a run that reads 1.5 km longer than it was.
 */
export const GPS_MIN_SEGMENT_M = 4;
/** Fastest a human (or a bicycle at sprint effort) legitimately moves; faster means noise. */
export const MAX_HUMAN_SPEED_MPS = 8;
/** Fixes worse than this are not even used to move the marker. */
const GPS_DISPLAY_ACCURACY_M = 60;
/** Points closer together than this are not stored; the route would be noise. */
const GPS_MIN_POINT_DISTANCE_M = 3;
/** How often progress is written to SQLite while recording. */
const FLUSH_INTERVAL_MS = 12_000;
/**
 * How much of a crash gap counts as "you were still running". Beyond this the
 * phone was in a pocket, not on a run, and resuming the timer would invent an
 * hour of exercise.
 */
const MAX_RECOVERY_GAP_SECONDS = 45 * 60;
const DRAFT_KEY = 'cardio.draft';
/** Points beyond this are resampled on save, to keep rows bounded. */
const MAX_STORED_POINTS = 2000;

export type LocationPermissionStatus =
  | 'granted'
  /** The user said no. The UI explains and offers the manual-entry path. */
  | 'denied'
  /** Not asked yet — the recorder asks when it starts. */
  | 'undetermined'
  /** iOS "Reduced accuracy" or Android "Approximate location". Distance drifts. */
  | 'reduced';

export type CardioDegradation =
  | 'permission-denied'
  | 'services-off'
  | 'no-signal'
  | 'reduced-accuracy';

export type CardioStatus = 'idle' | 'running' | 'paused' | 'finished' | 'discarded';

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
// Pure helpers. Exported for direct testing — none of this needs a device.
// ---------------------------------------------------------------------------

/**
 * Whether a fix is trustworthy, in order of preference: the device's own speed
 * estimate (derived from Doppler, so immune to position jitter), then a pace
 * sanity check. `null` means the platform gave no speed, which is not a
 * rejection — the caller still has the segment-length floor.
 */
export function isPlausiblePace(
  segmentMeters: number,
  elapsedMs: number,
  speedMps: number | null,
): boolean {
  if (speedMps !== null && Number.isFinite(speedMps)) {
    return speedMps >= 0 && speedMps <= MAX_HUMAN_SPEED_MPS;
  }
  if (elapsedMs <= 250) return true;
  return segmentMeters / (elapsedMs / 1000) <= MAX_HUMAN_SPEED_MPS;
}

/**
 * Distance to add for one candidate fix, or 0 when it is rejected. This is the
 * whole anti-jitter policy in one function, so it can be reasoned about — and
 * argued with — without reading a class.
 */
export function acceptedSegmentMeters(
  previous: RoutePoint | null,
  next: {
    t: number;
    coords: LatLng;
    accuracy: number | null;
    speed: number | null;
  },
): number {
  if (!previous) return 0;
  if (next.accuracy !== null && next.accuracy > GPS_ACCURACY_FLOOR_M) return 0;
  const raw = haversine(previous.coords, next.coords);
  if (raw < GPS_MIN_SEGMENT_M) return 0;
  if (!isPlausiblePace(raw, next.t - previous.t, next.speed)) return 0;
  return raw;
}

/**
 * Per-km splits from the recorded points, using timestamps rather than assuming
 * even sampling. The final split is the remainder and keeps its true length, so
 * a 5.2 km run reports six splits with the last one honestly labelled.
 */
export function buildSplits(route: readonly RoutePoint[]): ActivitySplit[] {
  if (route.length < 2) return [];
  return splitRouteByDistance(route, 1000).map((segment, i) => {
    const from = route[segment.fromIndex]!;
    const to = route[segment.toIndex]!;
    const durationSeconds = Math.max(1, (to.t - from.t) / 1000);
    const beats = route
      .slice(segment.fromIndex, segment.toIndex + 1)
      .map((p) => p.heartRate)
      .filter((hr): hr is number => hr !== null);
    return {
      index: i + 1,
      distanceMeters: Math.round(segment.meters),
      durationSeconds,
      paceSecPerKm: paceFromDistance(durationSeconds, segment.meters),
      elevationGainMeters: elevationGain(route.slice(segment.fromIndex, segment.toIndex + 1)),
      heartRate: beats.length > 0 ? Math.round(mean(beats)) : null,
    };
  });
}

/** Fallback distance for a session with no usable GPS: a plausible easy effort. */
export function estimatedDistanceMeters(kind: ActivityKind, seconds: number): number {
  const paceSecPerKm = { run: 330, walk: 780, ride: 150, yoga: 0, lift: 0 }[kind];
  if (paceSecPerKm <= 0) return 0;
  return Math.round((seconds / paceSecPerKm) * 1000);
}

export function degradationMessage(reason: CardioDegradation): string {
  switch (reason) {
    case 'permission-denied':
      return 'Location access is off, so distance is estimated from time.';
    case 'services-off':
      return 'Location services are switched off on this device.';
    case 'no-signal':
      return 'Waiting for a GPS signal — distance is estimated until one arrives.';
    case 'reduced-accuracy':
      return 'Precise location is off, so distance will drift.';
  }
}

export function locationPermissionErrorMessage(error: unknown): string | null {
  if (isOfflineError(error)) {
    return 'Your connection dropped. The activity keeps recording; rejoin and it resumes.';
  }
  return 'Could not read your location on this device, so distance is estimated from time.';
}

export function defaultActivityTitle(kind: ActivityKind): string {
  return { run: 'Morning run', ride: 'Ride', walk: 'Walk', yoga: 'Mobility', lift: 'Session' }[
    kind
  ];
}

/** Maps need `[lat, lng]` pairs; the route stores richer points. */
export function routeCoords(route: readonly RoutePoint[]): LatLng[] {
  return route.map((p) => p.coords);
}

/** Thinning for the map layer, which cannot draw 2000 segments at 60fps. */
export function displayRoute(route: readonly RoutePoint[], max = 400): LatLng[] {
  return resampleRoute(routeCoords(route), max);
}

/**
 * Ramer–Douglas-Peucker is overkill for storage; even sampling keeps the shape
 * honest and is cheaper to reason about. The endpoint is always preserved so
 * the recorded finish position is exact.
 */
export function trimRoute(route: readonly RoutePoint[], max = MAX_STORED_POINTS): RoutePoint[] {
  if (route.length <= max) return [...route];
  const stride = (route.length - 1) / (max - 1);
  const out: RoutePoint[] = [];
  for (let i = 0; i < max; i += 1) out.push(route[Math.round(i * stride)]!);
  out[max - 1] = route[route.length - 1]!;
  return out;
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
  /** Last point that passed the gates — the next segment is measured from it. */
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
        // accumulator has to absorb the gap up to the crash — but only up to
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
   * Route and totals carry over verbatim; only the clock restarts — and it
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
   * worth saving — the caller turns that into a "that was under 20 seconds,
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
        caloriesKcal: Math.round(caloriesRate(draft.kind) * seconds),
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
      this.status = 'finished';
      this.publish(true);
      return { activityId: activity.id, distanceMeters };
    } catch (error) {
      // A disk failure at save time is the one case where keeping everything
      // running is wrong: the user has already stopped. Leave the draft intact
      // so a retry can work, and surface why.
      this.lastError =
        error instanceof Error ? error.message : 'Could not save this activity.';
      this.publish(true);
      throw error;
    } finally {
      this.saving = false;
    }
  }

  async discard(): Promise<void> {
    await this.stopRecording();
    this.draft = null;
    this.status = 'discarded';
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
   * Foreground subscription. On iOS this is also the background path —
   * `UIBackgroundModes: location` keeps the subscription alive. Android stops
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
    } else if (draft.route.length === 0 && this.elapsedSeconds(draft, Date.now()) > 25) {
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
      caloriesKcal: Math.round(caloriesRate(draft?.kind ?? 'run') * elapsed),
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
