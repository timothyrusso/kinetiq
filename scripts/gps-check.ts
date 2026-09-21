/**
 * Executes the GPS acceptance policy against synthetic fixes.
 *
 *   npx tsx scripts/gps-check.ts
 *
 * This exists because the two things that could check this maths otherwise both fail to:
 * a device cannot be made to stand in a known sky (iOS Simulator streams no usable fixes
 * to a dev client, and the canned Drive scenarios are all car speeds, above the
 * plausibility gate), and there is no test runner in this project, `tsc` is the only
 * automated gate, and it checks types, not arithmetic. So the policy in `src/services/gps.ts`
 * would otherwise ship on a reading alone, for a feature whose whole job is not lying
 * about how far someone ran.
 *
 * The cases are chosen to fail loudly in *both* directions, because each gate trades one
 * wrong answer for another: a floor high enough to stop a parked phone also eats a slow
 * walk, and a plausibility ceiling that rejects a teleporting fix also rejects a cyclist.
 * Asserting only the accept side would pass a build that under-reads every real run.
 */

import {
  acceptedSegmentMeters,
  buildSplits,
  estimatedDistanceMeters,
  GPS_ACCURACY_FLOOR_M,
  GPS_MIN_SEGMENT_M,
  isPlausiblePace,
  MAX_HUMAN_SPEED_MPS,
  trimRoute,
} from '../src/services/gps';
import type { RoutePoint } from '../src/domain/types';
import { routeLength } from '../src/utils/geometry';

/** One degree of latitude, so a metre budget converts to degrees in one multiplication. */
const METRES_PER_DEG = 111_320;
const LAT = 45.0703;
const LNG = 7.6869;

function pt(t: number, metresNorth: number, elevation = 0): RoutePoint {
  return { t, coords: [LAT + metresNorth / METRES_PER_DEG, LNG], elevation, heartRate: null };
}

let failures = 0;
let checks = 0;
/**
 * `expected === 0` asserts rejection; a number asserts acceptance within one metre.
 * A near-miss is worth more than a boolean here, since the bug this guards against is
 * a threshold that is slightly wrong rather than entirely absent.
 */
function segment(
  subject: string,
  previous: RoutePoint | null,
  next: { t: number; coords: [number, number]; accuracy: number | null; speed: number | null },
  expected: number,
): void {
  checks += 1;
  const got = acceptedSegmentMeters(previous, next);
  const ok = expected === 0 ? got === 0 : Math.abs(got - expected) < 1;
  if (!ok) {
    failures += 1;
    console.log(`  ✗ ${subject}\n      expected ${expected === 0 ? '0 (reject)' : `≈${expected}m`}, got ${got.toFixed(2)}m`);
  } else {
    console.log(`  ✓ ${subject} → ${got.toFixed(1)}m`);
  }
}

// An open field: a fix one second ago, and a candidate north of it.
const base = pt(0, 0);
const at = (metres: number, opts: { accuracy?: number | null; speed?: number | null; dt?: number } = {}) => ({
  t: opts.dt ?? 1000,
  coords: [LAT + metres / METRES_PER_DEG, LNG] as [number, number],
  accuracy: opts.accuracy === undefined ? 5 : opts.accuracy,
  speed: opts.speed === undefined ? null : opts.speed,
});

console.log('\nacceptedSegmentMeters: one fix, four ways to be wrong\n');

// 1. Below the segment floor at *both* ends of the trade: 3.6 m of true motion in one
//    second is a genuine 3.6 m/s and a genuine rejection, because at 1 s sampling a
//    stationary phone jitters by about this much. Asserted as a rejection so the floor
//    is a decision on the record: the accepted case is number 6.
segment('a 3.6 m segment at 1 s sampling: under the floor', base, at(3.6), 0);
// And the same pace, sampled over ten seconds, is 36 m and passes: the floor is about
// distance-per-fix, not about how fast someone is allowed to move.
segment('the same 3.6 m/s pace over 10 s (36 m)', base, at(36, { dt: 10_000 }), 36);

// 2. The parked-phone case the whole gate exists for: a real-looking jump from a
//    genuinely unreliable fix. Distance is the sum of noise, and noise does not cancel.
segment(`a 12 m jump from ${GPS_ACCURACY_FLOOR_M + 21} m accuracy`, base, at(12, { accuracy: 45 }), 0);

// 3. Jitter at good accuracy: below the segment floor. This is the trade the floor
//    makes: 3.9 m of true motion is discarded along with the wobble.
segment(`a ${GPS_MIN_SEGMENT_M - 0.1} m jitter hop`, base, at(GPS_MIN_SEGMENT_M - 0.1), 0);

// 4. A teleport: position says 200 m in one second, and the device offers no speed to
//    contradict it. Position alone must lose this argument.
segment('a 200 m teleport with no speed reading', base, at(200), 0);

// 5. A 20 m/s reading from the device contradicts itself and loses, even though the
//    positions are 40 m apart and would otherwise pass every other gate.
segment('a car-speed Doppler reading', base, at(40, { speed: 20 }), 0);

// 6. Doppler is the tiebreaker the positions cannot supply: a fix whose 90 m jump reads
//    3 m/s is the phone admitting it moved. Without this case a runner in a tunnel of
//    jitter gets their distance silently eaten.
segment('a 90 m jump the device says was 3 m/s', base, at(90, { dt: 30_000, speed: 3 }), 90);

// 7. A slow walk: 1 m in one second is real motion that this design knowingly gives up
//    (see GPS_MIN_SEGMENT_M). Asserted as a rejection so the trade stays a decision and
//    not an accident someone discovers by reading a distance that came in short.
segment('a slow walk (1 m in 1 s): knowingly sacrificed', base, at(1), 0);

// 8. A first fix has nothing to measure from, so it can only ever be a start point.
segment('the very first fix (no previous point)', null, at(0), 0);

// 9. A platform that reports no accuracy is not a platform reporting bad accuracy: the
//    accuracy gate steps aside, so the remaining two gates carry the whole argument.
//    Not a free pass: the teleport is still rejected, and the sub-floor hop is still
//    rejected, purely on length and pace.
segment('no accuracy reported, honest motion at 3 m/s', base, at(30, { dt: 10_000, accuracy: null }), 30);
segment('no accuracy reported, but a teleport', base, at(200, { accuracy: null }), 0);

// 10. A stationary device reading speed 0 while its position drifts 12 m is the single
//     most common GPS artefact on a trail. The Doppler reading is the one to believe.
segment('position drifts 12 m while Doppler says 0 m/s', base, at(12, { speed: 0 }), 0);

console.log('\nthe floor and the ceiling, as the file states them\n');
for (const [label, value] of [
  ['GPS_ACCURACY_FLOOR_M', GPS_ACCURACY_FLOOR_M],
  ['GPS_MIN_SEGMENT_M', GPS_MIN_SEGMENT_M],
  ['MAX_HUMAN_SPEED_MPS', MAX_HUMAN_SPEED_MPS],
] as const) {
  checks += 1;
  if (!(value > 0 && Number.isFinite(value))) {
    failures += 1;
    console.log(`  ✗ ${label} = ${value}`);
  } else {
    console.log(`  ✓ ${label} = ${value}`);
  }
}
// The two thresholds must not contradict each other, or a fix gets rejected for a reason
// that depends on which gate it reaches first. The floor's own justification is "4 m at
// ~2 samples/second is 8 m/s", so 2 Hz is where the two are meant to meet.
checks += 1;
const impliedCeiling = GPS_MIN_SEGMENT_M / 0.5;
if (impliedCeiling !== MAX_HUMAN_SPEED_MPS) {
  failures += 1;
  console.log(`  ✗ floor implies a ${impliedCeiling} m/s ceiling at 2 Hz, but the ceiling is ${MAX_HUMAN_SPEED_MPS}`);
} else {
  console.log(`  ✓ the two thresholds meet at 2 Hz: ${GPS_MIN_SEGMENT_M} m ↔ ${MAX_HUMAN_SPEED_MPS} m/s`);
}

console.log('\nisPlausiblePace: the 250 ms dead band\n');
// Below the dead band, an elapsed time too small to divide by must not manufacture a
// rejection: 20 m in 100 ms reads 200 m/s, and were that honoured, every dense GPS
// sample would be discarded and a run would record zero distance.
checks += 1;
const deadBand = isPlausiblePace(20, 100, null);
if (!deadBand) {
  failures += 1;
  console.log('  ✗ dense samples rejected inside the dead band: distance would collapse to 0');
} else {
  console.log('  ✓ dense samples inside the dead band are not judged on speed');
}
checks += 1;
if (isPlausiblePace(200, 1000, null)) {
  failures += 1;
  console.log('  ✗ a 200 m/s position jump passed the pace check');
} else {
  console.log('  ✓ a 200 m/s position jump is rejected outside the dead band');
}
// A negative Doppler speed is a sensor fault, not an argument for reversal.
checks += 1;
if (isPlausiblePace(5, 1000, -3)) {
  failures += 1;
  console.log('  ✗ a negative speed reading was trusted');
} else {
  console.log('  ✓ a negative speed reading is rejected, not reinterpreted');
}

console.log('\nbuildSplits: six splits for 5.2 km, the last one honest\n');
// 5.2 km at an even 5:00/km, sampled every 5 m: the density a phone actually produces
// at running pace, and the density the geometry header claims. The old 100 m fixture
// would have hidden a boundary error of up to 95 m per kilometre behind its own coarseness.
const EVEN_T = 300; // seconds per km
const STEP_M = 5;
const run: RoutePoint[] = [];
for (let m = 0; m <= 5200; m += STEP_M) {
  run.push(pt((m / 1000) * EVEN_T * 1000, m, m / 10));
}
const splits = buildSplits(run);
// Expectations come from the route's *measured* length, not from the 5200 m the loop
// aimed at: converting metres to degrees of latitude is only exact on a sphere whose
// radius matches that constant, and haversine uses the one in geometry.ts. Deriving the
// target from routeLength means this fixture cannot drift away from the maths it checks, // which is exactly how the last three failures here were produced.
const routeM = routeLength(run.map((p) => p.coords));
const wholeKm = Math.floor(routeM / 1000);
const expectedSplits = routeM - wholeKm * 1000 > 1 ? wholeKm + 1 : wholeKm;
checks += 1;
if (splits.length !== expectedSplits) {
  failures += 1;
  console.log(`  ✗ a ${(routeM / 1000).toFixed(2)} km route produced ${splits.length} splits, expected ${expectedSplits}`);
} else {
  console.log(`  ✓ a ${(routeM / 1000).toFixed(2)} km route produced ${splits.length} splits (${wholeKm} whole km plus the remainder)`);
}
const last = splits[splits.length - 1];
const remainderM = routeM - wholeKm * 1000;
checks += 1;
if (!last || Math.abs(last.distanceMeters - remainderM) > STEP_M + 1) {
  failures += 1;
  console.log(`  ✗ the remainder split claimed ${last?.distanceMeters} m, expected ≈${remainderM.toFixed(0)}`);
} else {
  console.log(`  ✓ final split keeps its true length: ${last.distanceMeters} m of a real ${remainderM.toFixed(0)} m remainder, labelled index ${last.index}`);
}
// Every closed kilometre must sit within one sampling interval of the mark: this is the
// assertion the discarded-overshoot bug failed, and it is the one a user actually reads.
checks += 1;
const offMark = splits.slice(0, wholeKm).filter((s) => Math.abs(s.distanceMeters - 1000) > STEP_M + 1);
if (offMark.length > 0) {
  failures += 1;
  console.log(`  ✗ ${offMark.length} closed kilometre(s) are more than one sample off: ${offMark.map((s) => s.distanceMeters).join(', ')}`);
} else {
  console.log(`  ✓ all ${wholeKm} closed kilometres read ${splits[0]!.distanceMeters}±${STEP_M} m: no overshoot discarded`);
}
checks += 1;
const fifth = splits[4];
if (!fifth || Math.abs(fifth.paceSecPerKm - EVEN_T) > 8) {
  failures += 1;
  console.log(`  ✗ a full kilometre on an even pace read ${fifth?.paceSecPerKm} s/km`);
} else {
  console.log(`  ✓ a full kilometre on an even pace reads ${fifth.paceSecPerKm.toFixed(1)} s/km`);
}
// Splits must account for the route exactly: consecutive splits share a boundary point, so
// their distances sum to the whole trail with nothing invented or dropped.
const totalSplitM = splits.reduce((s, x) => s + x.distanceMeters, 0);
checks += 1;
if (Math.abs(totalSplitM - routeM) > splits.length) {
  failures += 1;
  console.log(`  ✗ splits sum to ${totalSplitM} m against a ${routeM.toFixed(0)} m route`);
} else {
  console.log(`  ✓ splits sum to ${totalSplitM} m against a ${routeM.toFixed(0)} m route: nothing invented or dropped`);
}
// A single point is not a route, and must not be reported as a one-kilometre split.
checks += 1;
const stub = buildSplits([pt(0, 0)]);
if (stub.length !== 0) {
  failures += 1;
  console.log(`  ✗ a one-point route produced ${stub.length} split(s)`);
} else {
  console.log('  ✓ a one-point route produces no splits, not a fabricated one');
}

console.log('\ntrimRoute: bounded rows, exact finish position\n');
const long: RoutePoint[] = Array.from({ length: 5000 }, (_, i) => pt(i * 1000, i * 2));
const trimmed = trimRoute(long, 2000);
checks += 1;
if (trimmed.length !== 2000) {
  failures += 1;
  console.log(`  ✗ trim returned ${trimmed.length} points for a max of 2000`);
} else {
  console.log(`  ✓ 5000 points trimmed to ${trimmed.length}`);
}
checks += 1;
const tail = trimmed[trimmed.length - 1];
if (!tail || tail.t !== long[4999]!.t || tail.coords[0] !== long[4999]!.coords[0]) {
  failures += 1;
  console.log('  ✗ thinning replaced the recorded finish position');
} else {
  console.log('  ✓ the recorded finish position survives thinning exactly');
}
checks += 1;
const untouched = trimRoute(run, 2000);
if (untouched.length !== run.length) {
  failures += 1;
  console.log(`  ✗ a short route was altered by trimming (${run.length} → ${untouched.length})`);
} else {
  console.log('  ✓ a route under the cap is returned point-for-point');
}

console.log('\nestimatedDistanceMeters: the fallback must never overstate\n');
// The fallback is what a user sees when GPS never arrived, so its sin is optimism.
// A strength session has no distance at all, and inventing one would put a pace on a
// workout that had none.
checks += 1;
if (estimatedDistanceMeters('lift', 3600) !== 0 || estimatedDistanceMeters('yoga', 3600) !== 0) {
  failures += 1;
  console.log('  ✗ a non-distance activity was assigned a distance');
} else {
  console.log('  ✓ lift and yoga estimate zero distance');
}
checks += 1;
// 330 s/km is the pace the function names, so an hour must be 3600/330 km and nothing
// else. Asserted as an exact correspondence: an estimate whose arithmetic disagrees with
// the pace it advertises is the failure mode this whole file is about.
const oneHourRun = estimatedDistanceMeters('run', 3600);
if (Math.abs(oneHourRun - (3600 / 330) * 1000) > 1) {
  failures += 1;
  console.log(`  ✗ an hour of running estimated ${(oneHourRun / 1000).toFixed(2)} km, not 3600/330 km`);
} else {
  console.log(`  ✓ an hour of running estimates ${(oneHourRun / 1000).toFixed(2)} km, matching its stated 5:30/km`);
}
checks += 1;
if (estimatedDistanceMeters('run', -500) !== 0) {
  failures += 1;
  console.log('  ✗ negative elapsed time produced negative distance');
} else {
  console.log('  ✓ negative elapsed time cannot produce negative distance');
}

console.log(`\n${failures === 0 ? 'all ' : ''}${checks - failures}/${checks} assertions passed${failures ? `, ${failures} FAILED` : ''}\n`);
process.exit(failures === 0 ? 0 : 1);
