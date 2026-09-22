/**
 * Shared device-QA harness for the scripts in this folder.
 *
 * Every check against the simulator needs the same five primitives, and each one has a
 * trap in it that cost real time to discover. Duplicating them across scripts meant fixing
 * a trap in one file and leaving it armed in the others, so they live here once.
 *
 * The traps, briefly (see network-check.js for the longer account):
 *
 *   - METRO IS PER-CALL. This machine runs another project's dev server on 8081; a flagless
 *     `open` clears the session's dev-server binding and the client can then load THAT
 *     bundle, where every kinetiq link looks broken. Every open passes METRO.
 *
 *   - A SNAPSHOT LISTS WHAT IS MOUNTED, NOT WHAT IS ON SCREEN: and RN recycles aggressively.
 *     Measured on the dev screen: a freshly-opened list reports 66 nodes with no ledger
 *     section in them at all (never mounted); one pan mounts it; two more reaches the bottom,
 *     where it reports `Grouped by path` at y = -31 (mounted, scrolled above the viewport);
 *     pan back up and most of it unmounts again. So `snapshot contains "Reset"` is not a
 *     question with a stable yes/no answer: it depends where you last scrolled. Everything
 *     here therefore asks about *visible* nodes (`visible()`), and scrolling is direction
 *     aware, because a node above you is not reached by swiping up.
 *
 *   - Which means a check must not read a number from one scroll position and assume it saw
 *     the screen. `scan()` walks top to bottom and unions what each stop mounts, which is the
 *     only way to ask "does this screen contain X at all" against a recycling list.
 *
 *   - Labels are not all StaticText: text that goes through Txt surfaces as an `Other` node,
 *     so every label reader here reads all roles.
 *
 *   - Refs go stale after any mutation, so nothing caches one across a scroll.
 *
 *   - The dev menu overlay looks exactly like a routing failure. dismissDevMenu() clears it.
 *
 *   - Scrolling is a *counted gesture* in this app's own terms but not a navigation: it never
 *     triggers a fetch, and neither does re-reading a screen already mounted in a tab.
 */
const { execSync } = require('child_process');

const CWD = '/Users/trusso/Desktop/Projects/kinetiq';
const METRO = '--metro-host 127.0.0.1 --metro-port 8083';
// Fallback tab centres, measured from the live native bar (a Liquid Glass capsule inset from
// the screen edges). `tab()` presses the labelled Button first; these are only used when that
// is somehow unavailable.
const TABS = { Home: '62 822', Activities: '131 822', Workout: '200 822', Exercises: '270 822', Profile: '340 822' };
const VIEWPORT_HEIGHT = 874;

function sh(cmd, { allowFail = false } = {}) {
  try {
    return execSync(cmd, { cwd: CWD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if (allowFail) return String(e.stdout ?? '') + String(e.stderr ?? '');
    throw e;
  }
}
const sleep = (s) => sh(`sleep ${s}`);

/**
 * The accessibility tree, or a loud failure: never a quiet empty list.
 *
 * The runner has a watchdog on accessibility capture, and a heavy or animating screen trips it:
 * the next call answers `RUNNER_BUSY` instead of a tree. The old body swallowed that and
 * returned `[]`, so a snapshot that FAILED was indistinguishable from a screen with nothing on
 * it: and every caller here treats an empty tree as "the app rendered nothing". One run
 * reported the cold-start search as never rendering while a screenshot of that exact moment
 * showed "53 exercises for squat" and a full list. The app was fine; the read was not.
 *
 * So a busy runner is retried rather than believed. If it never answers, the return is still
 * `[]`: callers cannot be rewritten to handle an exception here: but the reason is printed,
 * which is the difference between debugging the app and debugging the harness.
 */
function nodes({ tries = 4 } = {}) {
  let last = '';
  for (let i = 0; i < tries; i += 1) {
    const raw = sh('npx agent-device snapshot --json 2>&1', { allowFail: true });
    try {
      const parsed = JSON.parse(raw);
      if (parsed.success === false) {
        last = parsed.error?.code ?? 'UNKNOWN';
        // Busy is transient by definition: the runner is finishing the previous capture.
        if (last === 'RUNNER_BUSY') {
          sleep(3);
          continue;
        }
        break;
      }
      return (parsed.data ?? {}).nodes ?? [];
    } catch {
      last = 'UNPARSEABLE';
      sleep(1);
    }
  }
  console.log(`   (snapshot unavailable after ${tries} attempts: ${last}: reading as empty)`);
  return [];
}

/**
 * Is this node actually on screen right now?
 *
 * The whole harness hangs on this question. A node can be mounted and at y = -31 (scrolled
 * above), or mounted below the fold, and `press`/`tap` behave as though the first case is
 * pressable and the second is not. Anything that reads *content* must ask `visible()`;
 * anything that only asks "did the app ever render this" must use `scan()` instead of a
 * single snapshot.
 */
function visible(n) {
  const r = n?.rect;
  if (!r || !(r.height > 0) || !(r.width > 0)) return false;
  return r.y >= 0 && r.y + r.height <= VIEWPORT_HEIGHT;
}

/**
 * Where a tap on this node will actually land, and whether anything else is there.
 *
 * `visible()` answers "is this inside the viewport", which is a different and weaker question
 * than "will pressing it press it". This app pins chrome over its scrolling content at BOTH
 * ends: a translucent header at the top, the native tab bar at the bottom, and, while a
 * workout is running, the tab bar accessory pill on top of that. A list row scrolled under any
 * of them is still `visible()` by rect, still returned by `seek()`, and a press on its centre
 * hits the chrome instead. Both times that happened it was read as an app bug: once as a
 * routine screen "not showing its exercise rows" when the tap had actually opened the running
 * session from the pill, and once as a press that "did nothing" on a row beneath the header.
 *
 * So the press point is chosen rather than assumed. `occluderAt` asks the tree who is on top
 * of a point, using tree order as paint order and ignoring the target's own ancestors (a
 * containing view is not in the way of its child). `clearPointIn` then walks candidate points
 * inside the node, since a full-width row overlapped at the bottom centre is still perfectly
 * pressable 24pt in from its leading edge.
 */
function rectOf(n) {
  const r = n?.rect;
  return r && r.width > 0 && r.height > 0 ? r : null;
}

function covers(r, x, y) {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

function contains(outer, inner) {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height
  );
}

/**
 * Is this node reachable by a tap at all?
 *
 * `hittable` comes from the accessibility tree itself and is the runner's own answer to the
 * question every press here is really asking. It is strictly better than the rect test: a
 * screen left mounted UNDER the current one keeps perfectly valid on-screen rects, so
 * `visible()` says yes about a row the user cannot see or touch. That is not hypothetical:
 * the offline gate deep-linked the session screen over a routine detail, discarded, and then
 * found and "pressed" that routine's Start button through two screens. The tap landed on
 * whatever was actually in front, and the run reported the app as having started no session.
 *
 * `visible()` stays rect-based because reading CONTENT is a different question: a node
 * scrolled just past the fold is still content the screen holds, and `scan()` is what
 * answers that.
 */
function pressable(n) {
  return n?.hittable === true && n?.enabled !== false && visible(n);
}

/** The chain of `parentIndex` links from a node up to the root, as a set of indices. */
function ancestorsOf(node, ns) {
  const out = new Set();
  let cur = node;
  while (cur && typeof cur.parentIndex === 'number') {
    out.add(cur.parentIndex);
    cur = ns.find((n) => n.index === cur.parentIndex);
  }
  return out;
}

function isDescendant(node, ofIndex, ns) {
  return ancestorsOf(node, ns).has(ofIndex);
}

/** The topmost node drawn over (x, y) that is neither the target nor part of its own subtree. */
function occluderAt(target, x, y, ns = nodes()) {
  const tr = rectOf(target);
  if (!tr) return null;
  const idx = ns.findIndex((n) => n.ref === target.ref);
  if (idx < 0) return null;
  const mine = ancestorsOf(target, ns);
  // Later in tree order means painted later, so only what comes after can be on top.
  const above = ns.slice(idx + 1).filter((n) => {
    const r = rectOf(n);
    if (!r || n.ref === target.ref) return false;
    if (!covers(r, x, y)) return false;
    // Deliberately NOT filtered on `hittable`. The runner reports `hittable: false` for
    // almost every node in this app, including the workout pill that genuinely covers the
    // last routine row, so using it here switched occlusion detection off entirely and the
    // tap went back to opening the running session instead of the routine. Same rule as
    // everywhere else in this file: hittability may break a tie, it may never decide.
    // Occlusion is geometry, paint order and ancestry.
    // Its own ancestors and its own children are not in its way.
    if (typeof n.index === 'number' && mine.has(n.index)) return false;
    if (typeof target.index === 'number' && isDescendant(n, target.index, ns)) return false;
    // Anything that WHOLLY CONTAINS the target is a background, an ancestor or a full-screen
    // scrim: never a localised obstacle. The type no longer matters, and that matters: a
    // sheet's dismiss backdrop is a Button covering the entire screen, painted after the
    // sheet's own controls, so restricting this exemption to containers made the backdrop
    // "cover" the sheet's Done button and the CRUD gate refused to press it.
    //
    // Real occluders are SMALLER than what they hide: the workout pill sits over the bottom
    // of a full-width routine row, which is exactly why containment is the right test.
    if (contains(r, tr)) return false;
    return true;
  });
  return above.length ? above[above.length - 1] : null;
}

/**
 * A point inside this node that a tap will actually reach, or null if it is buried.
 *
 * Tries the centre first, because that is what everything expects, then points biased away
 * from the screen edges where the chrome lives: high in the row, low in the row, then in from
 * each side. Returns the first one nothing is covering.
 */
function clearPointIn(target) {
  const r = rectOf(target);
  if (!r) return null;
  const ns = nodes();
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const inset = Math.min(24, r.width / 3);
  const vInset = Math.min(10, r.height / 3);
  const candidates = [
    [cx, cy],
    [cx, r.y + vInset],
    [cx, r.y + r.height - vInset],
    [r.x + inset, cy],
    [r.x + r.width - inset, cy],
    [r.x + inset, r.y + vInset],
  ];
  for (const [x, y] of candidates) {
    if (y < 0 || y > VIEWPORT_HEIGHT) continue;
    if (!occluderAt(target, x, y, ns)) return { x: Math.round(x), y: Math.round(y) };
  }
  return null;
}

/** Nodes that are both on screen and carrying the given text, in render order. */
const onScreen = (text) => nodes().filter((n) => (n.label ?? '').includes(text) && visible(n));

/** Labels of everything visible right now. */
const labels = () => nodes().filter((n) => n.label && visible(n)).map((n) => n.label.trim());

/**
 * "Is this text on this screen?": scrolling top to bottom to find out.
 *
 * Named for what it does, because a single-snapshot `has()` would answer differently at
 * different scroll offsets, which is the worst possible property for an assertion to have.
 * Returns the union of every label every stop mounted, so callers can also assert on
 * absence, which a snapshot cannot establish at all.
 */
function scan({ maxStops = 10 } = {}) {
  scrollTop();
  const seen = new Set();
  let stops = 0;
  let last = null;
  for (; stops < maxStops; stops += 1) {
    for (const n of nodes()) if (n.label) seen.add(n.label.trim());
    const sig = signature();
    if (sig === last) break; // at the bottom: another pan changes nothing
    last = sig;
    panDown();
  }
  // Put the list back at the top before returning. `scan` answers "does this text exist
  // anywhere", and leaving the view at the BOTTOM is a side effect its callers do not expect:
  // the next `pressLabel` then finds its target at y=42, which `visible()` accepts and a tap
  // does not reach, because the translucent header is sitting over it. The press silently hits
  // the header, nothing navigates, and the check reports the screen it never left. Restoring
  // the position makes a scan a read rather than a move.
  scrollTop();
  return { text: [...seen].join('  '), stops: stops + 1 };
}

/** True if any of the needles appears anywhere on the screen, scrolling to look for it. */
function hasAnywhere(...needles) {
  const { text } = scan();
  return needles.every((needle) => text.includes(needle));
}

/** "Is this visible without touching anything?": for polling a screen you are already on. */
const has = (...needles) => {
  const t = labels();
  return needles.every((needle) => t.some((x) => x.includes(needle)));
};

/**
 * Is a not-found screen on screen, and which one?
 *
 * The app has two, deliberately: expo-router's own for a route with no file, and a
 * feature-level one for a link the router accepted but nothing claimed (copy that promises the
 * user's data is untouched, which the framework's cannot). A check that only recognises one
 * calls the other a timeout, and a timeout blames the app for being slow.
 */
const NOT_FOUND = ["Sorry, we couldn't find the page", 'There is no screen here'];
const matchesNotFound = (l) => (NOT_FOUND.some((p) => l.includes(p)) ? l : null);
/** Accepts a label list or one label; returns the offending label, or null. */
const isNotFound = (labelsOrLabel) =>
  Array.isArray(labelsOrLabel) ? labelsOrLabel.find(matchesNotFound) ?? null : matchesNotFound(labelsOrLabel);

/**
 * Fingerprint of what is on screen right now, so "did that swipe move anything?" has an
 * answer. The *visible* nodes only, and their labels, not just the first N in tree order:
 * the first twelve mounted nodes on the dev screen are header chrome that survives every
 * swipe, so a scan built on them concluded it had hit the bottom after two pans of a screen
 * with three pages on it, and reported half the ledger as the whole of it.
 */
function signature() {
  return labels().join('|');
}

/**
 * One scroll step: deliberately a SHORT swipe.
 *
 * A swipe is a fling, and the content keeps moving after the finger lifts. Measured on the dev
 * screen, travel per gesture:
 *
 *     280pt swipe -> more than a full viewport (the sampled row never appeared at all)
 *     120pt swipe -> 386pt    80pt swipe -> 269pt    40pt swipe -> 21pt (below the fling threshold)
 *
 * The old 280pt step therefore moved the content FURTHER THAN THE 874pt VIEWPORT in one go, so
 * anything that lived in the skipped band was never mounted at either sample point and read as
 * absent. That is how the fault matrix concluded the dev screen had no "Not found 404" row: the
 * row is there, and the scroll jumped straight over it.
 *
 * 80pt keeps travel (~269pt) comfortably under one viewport, so every row passes through a
 * sampled frame on its way past. It costs ~3x more gestures to cover the same distance, which is
 * the correct trade: a slow scroll finds the row, a fast one reports it missing.
 *
 * `agent-device scroll` would be the obvious alternative and does not work here: it reports
 * "Scrolled down by 240px" and the ScrollView does not move.
 */
const PAN_STEP = 80;
// Finger travels UP the screen to move content up, i.e. to reveal what is below.
function panDown() {
  sh(`npx agent-device swipe 201 600 201 ${600 - PAN_STEP} --pause-ms 150 2>/dev/null`, { allowFail: true });
  sleep(1);
}
// And the reverse, to get back to what we panned past.
function panUp() {
  sh(`npx agent-device swipe 201 ${600 - PAN_STEP} 201 600 --pause-ms 150 2>/dev/null`, { allowFail: true });
  sleep(1);
}

/** Walk back to the top, so a scan starts from a known place. */
function scrollTop({ max = 12 } = {}) {
  // Ask the tool first. `agent-device scroll top` reaches the top of a long list in one call
  // ("Scrolled to top with 3 up passes") where the pan loop cannot: a list left 40 pans deep
  // by an earlier check needs more than `max` swipes to climb back, and the loop gives up
  // silently and returns false. That is how the offline gate came to report "no visible search
  // field to type into" on a screen whose field was simply above the viewport.
  //
  // It is not trusted on its own, because it is view-dependent: on the dev screen the same
  // command reports success and moves nothing. So the pan loop still runs afterwards as the
  // guarantee: it exits after one comparison when the list really is at the top, so the cost
  // when the native call worked is a single snapshot.
  sh('npx agent-device scroll top --settle 2>&1', { allowFail: true });
  sleep(1);
  let last = null;
  for (let i = 0; i < max; i += 1) {
    const sig = signature();
    if (sig === last) return true;
    last = sig;
    panUp();
  }
  return false;
}

/**
 * Bring a node matching `want` on screen and return it.
 *
 * Direction matters and the obvious implementation gets it wrong: a match mounted at y = -31
 * is *behind* you, and swiping up: which is what "keep scrolling to find it" looks like, * moves it further away. So: if a match exists above the viewport, pan up; otherwise pan
 * down until either it becomes visible, or a pan changes nothing and it is genuinely absent.
 */
function seek(want, { max = 24 } = {}) {
  // Start from a known position when the target is not mounted anywhere in the tree. A screen
  // remembers where it was scrolled, so re-opening the dev screen after a scroll-to-bottom read
  // put the fault rows *above* the viewport, unmounted and therefore absent from the tree: and
  // the loop below walks DOWNWARD, so it reported "never found row" on a row that had pressed
  // fine seconds earlier. The few upward pans it does make cannot outrun its own
  // bottom-detection on a three-page screen. Rewinding costs two seconds; a misattributed
  // "the app has no such control" costs an afternoon.
  if (!nodes().some((n) => want(n))) scrollTop();
  let last = null;
  let upward = 0;
  for (let i = 0; i < max; i += 1) {
    const ns = nodes();
    const match = ns.find((n) => want(n));
    if (match && visible(match)) return match;
    if (match && (match.rect?.y ?? 0) < 0 && upward < 4) {
      upward += 1;
      panUp();
      continue;
    }
    const sig = signature();
    if (sig === last) return null; // bottom, and it is not here
    last = sig;
    panDown();
  }
  return null;
}

/** expo's dev menu, summoned by rapid tapping, renders over the app. */
const onDevMenu = () => has('Source code explorer');
function dismissDevMenu() {
  sh(`npx agent-device press 'text="Close"' 2>&1`, { allowFail: true });
  sleep(2);
}

/**
 * Open a kinetiq route and prove we landed on a real screen.
 *
 * Three screens are not the app and each needs a different response, so each is named
 * rather than reported as "the route failed": the dev-server picker (recoverable: press the
 * saved 8083 row), expo's dev menu (recoverable: Close), and a genuinely unrouted link
 * (a real bug: fail).
 *
 * `expectText` is a viewport read first and a full scan only as a fallback. Leading with a
 * scan was correct in principle: a screen whose hero is mounted but whose content is still
 * arriving should not be called landed: and ruinous in practice: a scan walks a list to its
 * bottom and back, so every navigation cost ~90 s, and on the exercise list it *paged* the
 * list as a side effect of merely arriving. After two viewport reads come up empty the scan
 * is worth its cost, because at that point something really is slow or missing.
 */
/**
 * @param scan true lets a failed viewport read escalate to a full-page scan. OFF by
 *   default: scanning walks the screen to its bottom and back, which on a long LIST pages it,
 *   and the page fetches land in the ledger as if the app had sent them unprompted. That
 *   single side effect produced a morning of "the app is chatty on tab switches" findings that
 *   were the harness reading the exercise list for itself. Turn it on for a screen you
 *   genuinely need to search, and only off the measurement path.
 */
/**
 * `home` is the tab group's index, so it has no path of its own, `kinetiq://home` is a link
 * to nowhere and lands on the feature-level not-found screen. The app is correct about that;
 * the harness was wrong to ask. Mapping the name to the bare scheme means scripts can name the
 * screen they want instead of remembering which of them is an index.
 */
/**
 * Is our own Metro answering on 8083?
 *
 * Worth its own check because a dead bundler is indistinguishable, from the device, from a broken
 * app: the client cannot fetch a bundle, so it falls back to the Expo dev-server picker, and every
 * navigation after that lands on the picker instead of a screen. A whole run once reported "still
 * on the dev-server picker after reconnecting to 8083": true, and useless, because the thing it
 * was reconnecting to had exited. `/status` answers `packager-status:running`; anything else on
 * that port is somebody else's server and must not be pressed into service (8081 on this machine
 * belongs to another project, and loading ITS bundle is how a kinetiq run ends up driving a
 * foreign app).
 */
function metroAlive() {
  const out = sh('curl -s --max-time 3 http://127.0.0.1:8083/status 2>&1', { allowFail: true });
  return /packager-status:running/.test(out);
}

const ROUTE_PATHS = { home: '' };

/**
 * @param soft navigate, but answer `false` instead of failing when we cannot land. For cleanup
 *   only: a teardown that cannot reach the dev screen must not convert a PASS into exit 1, and
 *   an `onExit` hook that calls `fail()` aborts the remaining cleanups with it. A measurement
 *   step wants the hard failure: a step that never landed is not a measurement.
 */
function open(route, expectText, { scan: allowScan = false, soft = false } = {}) {
  if (route in ROUTE_PATHS) route = ROUTE_PATHS[route];
  const refused = (msg) => (soft ? (console.log(`   (${msg})`), false) : fail(msg));
  let recoveredMenu = false;
  let recoveredPicker = false;
  let recoveredSession = false;
  const deepLink = () =>
    sh(`npx agent-device open "kinetiq://${route}" ${METRO} 2>&1`, { allowFail: true });
  let out = deepLink();
  for (let i = 0; i < 10; i += 1) {
    const t = labels();
    // A stale agent-device session holds the device and answers every call with this, after
    // which the app is running but unreachable and each read comes back empty. One thing to do:
    // close it, which the tool says is safe to retry, then re-open. Without this branch the
    // loop just polls nothing for twenty seconds and reports "never saw <hero>", which reads as
    // a broken screen rather than a busy tool.
    if (/DEVICE_IN_USE/.test(out) && !recoveredSession) {
      recoveredSession = true;
      console.log('   agent-device session is holding the device: closing it and retrying');
      sh('npx agent-device close --session default 2>&1', { allowFail: true });
      sleep(2);
      out = deepLink();
      continue;
    }
    if (t.some((x) => /DEVELOPMENT SERVERS|RECENTLY OPENED/.test(x))) {
      // Diagnose before retrying. If the bundler is gone there is nothing on the other end of
      // that row, and pressing it twice only turns an environment failure into a fake app bug.
      if (!metroAlive()) {
        return refused(
          'the app is on the Expo dev-server picker because Metro is not answering on 8083. ' +
            'Nothing is wrong with the app or this route: start the bundler ' +
            '(`npx expo start --port 8083`) and re-run. Do not point it at 8081; that is ' +
            "another project's server, and its bundle is a different app.",
        );
      }
      if (recoveredPicker) return refused(`still on the dev-server picker after reconnecting to 8083`);
      recoveredPicker = true;
      console.log('   app is on the dev-server picker: reconnecting to 8083');
      // By ref, not by selector. This used to press `text^="http://127.0.0.1:8083"`, and
      // `text^` is not a selector key agent-device has (id, role, text, label, value, … are);
      // every attempt returned INVALID_ARGS, so the recovery never once pressed anything and
      // the run blamed the app for staying on the picker. The row's own label carries the
      // project name too ("Kinetiq, http://127.0.0.1:8083"), so match on a substring and press
      // the node we actually found.
      const entry = nodes().find(
        (n) => (n.label ?? '').includes('127.0.0.1:8083') && n.ref,
      );
      if (!entry) {
        return refused(
          'the dev-server picker does not list http://127.0.0.1:8083, so there is nothing to ' +
            'reconnect to. Start Metro on 8083 and re-run.',
        );
      }
      sh(`npx agent-device press '@${entry.ref}' 2>&1`, { allowFail: true });
      sleep(18);
      out = deepLink();
      continue;
    }
    if (onDevMenu()) {
      if (recoveredMenu) return refused('expo dev menu returned after being dismissed: investigate');
      recoveredMenu = true;
      console.log('   expo dev menu is covering the app: dismissing it');
      dismissDevMenu();
      out = deepLink();
      sleep(4);
      continue;
    }
    // Not-found is a verdict, not a retry: the route is genuinely unrouted, and looping ten
    // times waiting for a hero that will never mount just wastes a minute before saying so.
    //
    // Both of the app's two not-found screens count. The router's own catches a missing route;
    // the feature-level one (`app/_not-found.tsx`) catches a link the router accepted but no
    // screen claimed, and the two have different copy. Checking for one literal string meant a
    // typo'd route spent the full polling budget on it and then reported "never saw the hero", // true, but it hides the actual reason, which is printed right there on screen.
    if (isNotFound(t)) {
      return refused(
        `"${route}" resolved to a not-found screen (${t.find(isNotFound).slice(0, 60)}), ` +
          'unrouted or mistyped deep link',
      );
    }
    if (!expectText || has(expectText) || (allowScan && i >= 2 && hasAnywhere(expectText))) {
      return true;
    }
    sleep(2);
  }
  // A caller who passed expectText asked a question, "prove we are on that screen": and a
  // false answer to it is not a state worth continuing in. Returning false used to let scripts
  // carry on, and they did: one ran its offline routine audit against the Workout tab because
  // the navigation before it had quietly failed, and reported "routine vanished" about screens
  // it had never looked at. Failing here attributes the problem to the navigation, which is
  // where it is, instead of to the app several steps later.
  return refused(`never saw "${expectText}" after opening "${route}": refusing to continue`);
}

/**
 * Register a cleanup that MUST run even when the script fails.
 *
 * `fail()` exits, and a device does not forget what a dead script left behind. Every check in
 * this folder that arms a fault, edits a routine or types into a search box has to undo it, or
 * the next check inherits the state and reports it as a defect in the app: which is precisely
 * how a fault-matrix run died mid-case and the next one's baseline search came back failed,
 * producing "the baseline never committed" about a perfectly healthy network. Registered here,
 * run on every exit path, including a plain `process.exit` from fail().
 */
const cleanups = [];
let cleaning = false;
function onExit(fn) {
  cleanups.push(fn);
}
function runCleanups() {
  if (cleaning || !cleanups.length) return;
  cleaning = true;
  for (const fn of cleanups.reverse()) {
    try {
      fn();
    } catch (e) {
      console.error(`   (cleanup failed: ${String(e).slice(0, 120)})`);
    }
  }
  cleanups.length = 0;
}
process.on('exit', runCleanups);

/**
 * Is a fault currently armed? Cheap enough to call at the top of a check, and the answer
 * decides whether the network is safe to measure anything against.
 */
/**
 * These two navigate, and every caller of `clearFaultQuietly` is an `onExit` hook. Failing
 * there would exit 1 over a teardown: turning a genuine PASS into a red run: and would abort
 * the remaining cleanups with it, so the second half of a script's tidying never happens. Soft
 * by definition: print why the device could not be reached, report what is knowable (unknown =
 * false), and let the verdict stand on what was actually measured.
 */
function faultArmed() {
  if (!open('dev', 'Developer', { soft: true })) return false;
  return seek((n) => /Failing the next|Slowing the next/.test(n.label ?? ''), { max: 8 }) !== null;
}

/**
 * Arm one fault, from any starting state.
 *
 * The dev screen's armer is a TOGGLE whose label changes with its state: "Arm" when idle,
 * "Armed" when live. `pressRow` accepts both spellings, which is right for finding the
 * control and wrong for arming it: pressing a row that already reads "Armed" turns the fault
 * OFF, and the caller then verifies, sees "No fault armed", and reports that arming does not
 * work. That is what happened when step 2 armed and step 3 re-armed a beat later.
 *
 * So this clears first and arms second. Disarming something already disarmed is free, and it
 * also removes the other half of the problem: an armed fault left behind by an earlier script
 * is a different fault from the one this caller wants, and "something is armed" is not the
 * same claim as "this is armed".
 */
function armFault(title) {
  clearFaultQuietly();
  if (!pressRow(title, ['Arm', 'Armed'])) return false;
  // The summary line is the app's own confirmation, e.g. `Failing the next 3 requests with
  // "offline".` Without checking it, every later assertion rests on an assumption.
  if (!hasAnywhere('Failing the next') && !hasAnywhere('Slowing the next')) {
    console.error(`   !! pressed the "${title}" armer but the dev screen reports no armed fault`);
    return false;
  }
  return true;
}

/** Disarm whatever is armed, if anything. Safe to call when nothing is. */
function clearFaultQuietly() {
  if (!open('dev', 'Developer', { soft: true })) return false;
  if (seek((n) => (n.label ?? '').trim() === 'Stop injecting', { max: 8 })) {
    const b = nodes().find((n) => (n.label ?? '').trim() === 'Stop injecting');
    sh(`npx agent-device press '@${b.ref}' 2>&1`, { allowFail: true });
    sleep(1);
    return true;
  }
  return false;
}

/**
 * Kill the app stone dead and bring it back, which is the only way to ask the brief's
 * "terminate mid-workout and relaunch" question.
 *
 * `simctl terminate` is not backgrounding (which keeps the process and its timers alive) and
 * not a reload (which keeps the JS module registry, and therefore any module-level state a bug
 * is hiding in). It removes the process, so anything still standing afterwards came out of the
 * database: which is the property under test.
 *
 * The session is closed first on purpose: the tool keeps its attachment across a terminate, and
 * then reports an app that is running but unreachable as a run of empty snapshots. Several
 * minutes of polling nothing, for a "the screen is blank" finding. Close, terminate, launch, and
 * let `open` re-attach: it now recovers a held device instead of timing out on it.
 */
const SIMULATOR_UDID = process.env.SIMULATOR_UDID ?? '0C66B8BE-737D-4E57-A6DA-4B015C03953E';
const BUNDLE_ID = process.env.BUNDLE_ID ?? 'app.kinetiq.mobile';
function restartApp() {
  sh(`xcrun simctl terminate ${SIMULATOR_UDID} ${BUNDLE_ID} 2>&1`, { allowFail: true });
  sleep(2);
  const launched = sh(`xcrun simctl launch ${SIMULATOR_UDID} ${BUNDLE_ID} 2>&1`, { allowFail: true });
  if (/Unable to find|Error:/.test(launched)) {
    fail(`simctl could not launch ${BUNDLE_ID}: ${launched.trim().slice(0, 160)}`);
  }
  // Poll for the process to come up rather than paying a flat 8s: a warm launch is ready in
  // about two. `nodes()` returns [] until the app answers, so a non-empty tree IS the signal.
  settle(() => nodes({ tries: 1 }).length > 0, { seconds: 12, label: 'the app to relaunch' });
  // Re-attaching is deliberately NOT done here. The agent-device session survives a terminate
  // and then holds a dead attachment: every snapshot comes back empty and reads as a blank
  // app. Closing it from here raced the launch instead (open() then hit DEVICE_IN_USE against
  // the session it had just deleted). `open()` owns that whole recovery: it recognises
  // DEVICE_IN_USE in its own output, closes the stale session once, and retries. So restartApp
  // stops at the launch, and the caller's first `open`: which navigates AND proves the landing
  // screen: is the thing that waits for the cold start to have actually rendered.
  return true;
}

/**
 * Read the app's SQLite file from the HOST, while the app is running.
 *
 * Some things a snapshot cannot tell you. "Did the routine survive a force-quit?" reads the same
 * on screen whether it was persisted or re-derived from an in-memory cache, and "is the row
 * actually gone, or just filtered out of the list?" is unanswerable from pixels. The database is
 * the only witness with standing for those, and it is a plain file the simulator keeps on this
 * disk: so a check can ask it directly instead of trusting the screen that is being tested.
 *
 * Verified on device rather than assumed: the file is in WAL mode, and a `-readonly` open of a
 * WAL database succeeds here (the `-shm` file is present) and returns rows three times in a row
 * while another QA run is mid-write. Reading is therefore safe concurrently; nothing here opens
 * for write, ever, which is the property that keeps it safe.
 *
 * SQL goes in over stdin, not as a shell argument. Routine names are user text and an apostrophe
 * in one would otherwise break the quoting and report as a syntax error in the wrong layer.
 */
function dbQuery(sql) {
  const cont = sh(`xcrun simctl get_app_container ${SIMULATOR_UDID} ${BUNDLE_ID} data 2>&1`).trim();
  if (!/\/Containers\/Data\/Application\//.test(cont)) {
    fail(`cannot locate the app container to read the database: ${cont.slice(0, 120)}`);
  }
  const db = `${cont}/Documents/SQLite/kinetiq.db`;
  let raw;
  try {
    raw = execSync(`/usr/bin/sqlite3 -readonly "${db}" -separator "\t"`, {
      encoding: 'utf8',
      input: sql,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    fail(`could not read ${db}: ${String(e.stderr ?? e.message).trim().slice(0, 200)}`);
  }
  return raw
    .split('\n')
    .filter((l) => l.length)
    .map((l) => l.split('\t'));
}

/**
 * Run a WRITE against the app's database. Cleanup only.
 *
 * `dbQuery` opens read-only on purpose, and everything that reads should keep using it: a
 * check that can mutate the thing it is measuring is not a check. This exists for exactly one
 * job: removing rows a previous aborted run left behind, which cannot be done through the UI
 * because the run died before reaching its own teardown.
 *
 * Callers must scope the statement to their own fixtures. Deleting anything not created by the
 * run that is deleting it is a bug in the caller, not a policy this function can enforce.
 */
function dbExec(sql) {
  const cont = sh(`xcrun simctl get_app_container ${SIMULATOR_UDID} ${BUNDLE_ID} data 2>&1`).trim();
  if (!/\/Containers\/Data\/Application\//.test(cont)) {
    fail(`cannot locate the app container to write to the database: ${cont.slice(0, 120)}`);
  }
  try {
    execSync(`/usr/bin/sqlite3 "${cont}/Documents/SQLite/kinetiq.db"`, {
      encoding: 'utf8',
      input: sql,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (e) {
    return String(e.stderr ?? e.message).trim();
  }
  return '';
}

/** Same query, expecting exactly one column: `['a', 'b']`. */
function dbCol(sql) {
  return dbQuery(sql).map((r) => r[0]);
}

/**
 * Type into a field and put the keyboard away.
 *
 * Dismissal is correctness, not tidiness. While the keyboard is up:
 *
 *   - it owns the lower half of the screen, so `visible()` reports the KEYS as the visible
 *     nodes. A check reading the screen after typing sees `Next keyboard / Padding-Left / q`
 *     and concludes the app rendered nothing.
 *   - every pan here swipes at y=600..520, which is INSIDE the keyboard. `scrollTop` and `seek`
 *     stop scrolling the list and start stroking keys: one run typed a stray "q" into the app
 *     with its own scroll gesture.
 *   - worst, the keyboard screen is heavy enough to trip the runner's accessibility-capture
 *     watchdog, after which every snapshot answers RUNNER_BUSY. That is unrecoverable from
 *     inside the tool: `keyboard return` needs the runner, and the runner is busy because the
 *     keyboard is up.
 *
 * So the dismissal is a COORDINATE TAP, which needs no snapshot and therefore cannot deadlock
 * against a busy runner. `keyboard dismiss` is the obvious call and reports
 * UNSUPPORTED_OPERATION on iOS; `keyboard return` works only while the runner is idle, which
 * is exactly when it is not needed.
 *
 * The default target is the horizontal centre just under the nav bar: a title on every screen
 * this harness types on. Pass `blurAt` for a screen where that would hit a control.
 */
function fillField(ref, text, { blurAt = '201 120' } = {}) {
  sh(`npx agent-device fill @${ref} ${JSON.stringify(text)} 2>&1`, { allowFail: true });
  sleep(1);
  // `blurAt: null` means "leave the keyboard up": for a bottom SHEET there is often no safe
  // point to tap at all. Above the sheet is the backdrop, which dismisses it and takes the
  // commit button along; inside the sheet, below the field, is the keyboard, and tapping that
  // types a character. A rename committed as "… IIg" because the blur point landed on the g
  // key. The sheet also slides up when the keyboard opens, so any coordinate computed from the
  // pre-keyboard tree is stale by the time it is used. Callers in that position skip the blur
  // and press the sheet's own button, which is still reachable and commits the field anyway.
  if (blurAt === null) return;
  sh(`npx agent-device press ${blurAt} 2>&1`, { allowFail: true });
  sleep(2);
}

/**
 * Force the app into English, for the duration of the run.
 *
 * Every gate in this suite matches user-visible copy: "SEARCH EXERCISES", "Try again", "Start
 * this workout". Once the app gained a language setting, those matches became locale dependent,
 * and this machine's simulator is set to it-CH, so `language: 'system'` resolves to Italian and
 * the whole suite failed on its first assertion with "never saw SEARCH EXERCISES" against a
 * screen reading CERCA ESERCIZI.
 *
 * Written straight to the settings row rather than driven through the UI: tapping a segmented
 * control costs a navigation and a snapshot per gate, and this has to happen before the first
 * assertion of every gate, including the ones that start on a screen with no way to reach
 * Settings. `hydrateSettings` reads this row on launch, so the value takes effect from the next
 * restart, which every gate does anyway.
 *
 * It does NOT restore the previous value. The setting is the user's, and a gate that failed
 * halfway would leave it half-restored; the run says plainly that it forces English, and
 * switching back is one tap.
 */
function forceEnglishUI() {
  const err = dbExec("insert into settings (key, value_json, updated_at) values ('settings.language', '\"en\"', "
    + `${Date.now()}) on conflict(key) do update set value_json = '"en"', updated_at = ${Date.now()};`);
  if (err) console.log(`   (could not force English: ${err.slice(0, 80)})`);
}

function fail(msg) {
  console.error(`   !! ${msg}`);
  process.exit(1);
}

/**
 * Press a real button by its label, scrolling to it first.
 *
 * Also accepts `text^="…"` to mean "press the node whose label STARTS WITH this", for the cases
 * where an exact label is ambiguous: a routine row and its own title node share text, and
 * `label="X"` throws AMBIGUOUS_MATCH.
 *
 * `text^=` is this harness's own shorthand, NOT an agent-device selector. It looks like one,
 * which is the trap: agent-device supports id, role, text, label, value, appname, windowtitle
 * and the state flags, and anything else is INVALID_ARGS. Passing `text^=` straight through
 * therefore always failed: silently, wherever a caller ignored the result: so it is resolved
 * here, against a snapshot, and pressed by ref.
 */
function pressLabel(label, { probe = false } = {}) {
  // `probe` for a press whose absence is a legitimate answer: "clear the fault if one is
  // armed", "press Retry if the screen still offers one". Those calls printed `!! never
  // found` into a passing run, which trains a reader to skim the one line that matters.
  const report = probe ? (msg) => console.log(`   (${msg})`) : (msg) => console.error(`   !! ${msg}`);
  // A predicate is allowed, and preferred whenever the match is subtler than equality. It
  // exists because the alternative here was `pressLabel('text^="Legs. "')`, a selector
  // agent-device does not have: it fell through to a substring match that looked like a
  // prefix match, which is the kind of near-miss that reads as an app bug later.
  const quoted = typeof label === 'string' ? (label.split('"')[1] ?? '') : '';
  const want =
    typeof label === 'function'
      ? label
      : // `text^=` means STARTS WITH, which is the whole reason it exists: a routine row and
        // the Resume card above it both contain the routine's name, and only the row begins
        // with it. Implemented with `includes` it matched both, picked whichever came first
        // in tree order, and the offline gate spent a run reporting that a routine detail
        // "does not show its exercise rows" after resuming a workout instead of opening it.
        label.startsWith('text^=')
        ? (n) => (n.label ?? '').trim().startsWith(quoted)
        : label.startsWith('text') || label.startsWith('role')
          ? (n) => (n.label ?? '').includes(quoted)
          : (n) => (n.label ?? '').trim() === label;
  const what = typeof label === 'function' ? (label.name || 'predicate') : label;
  // Only hand the selector straight to agent-device when it is one agent-device HAS. The
  // supported keys are id, role, text, label, value, appname, windowtitle and the state flags, // `text^=` is not among them and comes back INVALID_ARGS every time, so trying it first just
  // buys a guaranteed-failing subprocess before the fallback does the real work.
  const supported = typeof label === 'string'
    && /^(id|role|text|label|value|appname|windowtitle)=/.test(label);
  if (supported) {
    // Let agent-device disambiguate itself where it can, once, before falling back.
    const out = sh(`npx agent-device press '${label}' 2>&1`, { allowFail: true });
    if (!/Error|INVALID|FAILED|AMBIGUOUS/.test(out)) {
      sleep(1.2);
      return true;
    }
  }
  // Prefer an actual control. A label is frequently carried by more than one node: the
  // Workout tab has "New routine" on both the top-right Button (38pt wide) and an `Other`
  // container spanning the whole screen: and `seek` returns whichever comes first in tree
  // order. Pressing the container is a no-op that REPORTS SUCCESS, so the caller believes it
  // navigated and then asserts against the screen it never left. That is exactly how the CRUD
  // gate failed its first run: "pressed New routine: true", still on the Workout tab.
  // Look in the tree we already have BEFORE asking anything to scroll.
  //
  // Two hard-won constraints, and they interact:
  //
  // 1. A BUTTON wins over anything else carrying the same label, whether or not the runner
  //    calls it hittable. `hittable` is false on plenty of this app's working buttons (the
  //    session screen's `Discard`, the language segments, the error state's `Try again`), so
  //    it may break ties and must never decide. When hittability outranked node type, a
  //    rejected Button fell through to the FULL-SCREEN `Other` with the same label, and the
  //    tap landed in the middle of the exercise list while reporting success.
  //
  // 2. Searching must not move the screen while the target is already on it. `seek` scrolls,
  //    and `scrollTop()` pans UP, which on a bottom sheet is a swipe DOWN: it dismisses the
  //    thing being searched. That is how a press on a confirmation that `waitFor` had just
  //    found reported "no such control": the first tier missed on hittability, the scroll
  //    closed the sheet, and every later tier searched a screen the sheet had left.
  //
  // So: four passes over the CURRENT snapshot, cheapest and most specific first, and only
  // then the scrolling search for something genuinely off-screen.
  const present = nodes();
  const inTree = (pred) => present.find(pred) ?? null;
  const node =
    inTree((n) => want(n) && n.type === 'Button' && pressable(n)) ??
    inTree((n) => want(n) && n.type === 'Button' && visible(n)) ??
    inTree((n) => want(n) && pressable(n)) ??
    seek((n) => want(n) && n.type === 'Button') ??
    seek(want);
  if (!node?.ref) {
    report(`no "${what}" on screen`);
    return false;
  }
  if (!pressable(node)) {
    // A note, not a refusal. `hittable` is the runner's own hit test and it produces false
    // negatives: the segments of the language control report `hittable: false` with nothing
    // whatsoever covering them, and a coordinate tap on the same point switches the language.
    // Treating it as a veto turned a working control into "not touchable" and would have had
    // the app blamed for it. Occlusion below is the veto, because that one is evidence: a
    // named node really is drawn over the point.
    console.log(
      `   (note: "${what}" reports hittable=${node.hittable}; pressing it anyway)`,
    );
  }
  // Who is on top of it. `press '@ref'` taps the node's centre, so a row scrolled under the
  // header, the tab bar or the running-workout pill is pressed THROUGH that chrome and the
  // press silently activates something else.
  const point = clearPointIn(node);
  if (!point) {
    // Scrolling is the only remedy left: the node is wholly buried. One step each way, then
    // give up loudly rather than pressing chrome and reporting success.
    for (const nudge of [panDown, panUp]) {
      nudge();
      const again = nodes().find((n) => want(n));
      const p2 = again ? clearPointIn(again) : null;
      if (p2) {
        sh(`npx agent-device tap ${p2.x} ${p2.y} 2>&1`, { allowFail: true });
        sleep(1.2);
        return true;
      }
    }
    const blocker = occluderAt(node, node.rect.x + node.rect.width / 2, node.rect.y + node.rect.height / 2);
    report(
      `"${what}" is on screen but completely covered by ` +
        `"${(blocker?.label ?? blocker?.type ?? 'unknown chrome').trim()}": not pressing it`,
    );
    return false;
  }
  const out = sh(`npx agent-device tap ${point.x} ${point.y} 2>&1`, { allowFail: true });
  if (/Error|INVALID|FAILED/.test(out)) {
    report(`press "${what}": ${(out.split('\n').find((l) => /Error/.test(l)) ?? out).trim()}`);
    return false;
  }
  sleep(1.2);
  return true;
}

/**
 * Wait for a condition instead of guessing how long it takes.
 *
 * The suite carried ~270 seconds of hardcoded `sleep` per pass, each one sized for the
 * slowest case ever observed and paid in full every run: a `sleep(12)` after a search that
 * usually renders in two. Polling costs one snapshot per second and returns the moment the
 * condition holds, so the common case stops subsidising the rare one.
 *
 * `min` exists because some waits are genuinely about letting the app go QUIET rather than
 * about something appearing, and a poll that fires on the first frame would beat the very
 * traffic it is meant to let settle.
 */
function settle(want, { seconds = 12, min = 0, label = 'the app' } = {}) {
  for (let waited = 0; waited < min; waited += 1) sleep(1);
  for (let waited = min; waited < seconds; waited += 1) {
    try {
      if (want()) return true;
    } catch {
      // A snapshot mid-transition can throw; that is simply "not yet".
    }
    sleep(1);
  }
  console.log(`   (waited ${seconds}s for ${label} without the condition holding; continuing)`);
  return false;
}

/** Sugar for the commonest case: wait until some text is on screen. */
function settleForText(text, opts = {}) {
  return settle(() => nodes().some((n) => (n.label ?? '').includes(text)), {
    label: `"${text}"`,
    ...opts,
  });
}

/**
 * Wait until a node matching `want` is in the tree, re-snapshotting until it is.
 *
 * For content that arrives in its OWN window rather than in the screen being scrolled: a
 * sheet, a confirmation, an alert. `seek` cannot help there, because its remedy is panning
 * and the nodes are not off-screen, they are not in the captured tree at all. Measured on the
 * discard confirmation: three seconds after the press the snapshot held only the base window
 * and every node in it reported `hittable: false`, while a screenshot of the same instant
 * showed the sheet fully presented with its two buttons. Panning for it reported "never
 * found" about a control that was on screen and working.
 *
 * So this re-asks rather than re-scrolls. `hittable: false` on every node of a screen is the
 * tell that something is presented over it, which is also why it is not used as a veto
 * anywhere in this file.
 */
function waitFor(want, { seconds = 8, label = 'it' } = {}) {
  for (let waited = 0; waited < seconds; waited += 1) {
    const match = nodes().find(want);
    if (match) return match;
    sleep(1);
  }
  console.log(`   (gave up waiting ${seconds}s for ${label} to enter the tree)`);
  return null;
}

/**
 * Tap the centre of whatever shows this text.
 *
 * The fallback for pressables that are not exposed as buttons at all: the fault rows on
 * the dev screen are custom cards, so `press 'label="No connection"'` fails on them, while a
 * tap inside the row's bounds works. Prefer `pressLabel` for a real Button, and `pressRow`
 * for a titled card, because a coordinate tap can land on a neighbouring row; this one is
 * for text that *is* the control.
 */
function pressText(text) {
  const node = seek((n) => (n.label ?? '').includes(text));
  if (!node) {
    console.error(`   !! never found "${text}" on screen to tap`);
    return false;
  }
  sh(`npx agent-device tap ${Math.round(node.rect.x + node.rect.width / 2)} ${Math.round(node.rect.y + node.rect.height / 2)} 2>&1`, { allowFail: true });
  sleep(1.2);
  return true;
}

/**
 * Press the button that belongs to a titled row.
 *
 * Needed because several rows here are custom cards: the dev screen's failure armers each
 * show a title as plain text and a button labelled just `Arm`, so no selector names the
 * *row*. Matching by geometry: the nearest such button below the title, both on screen, * is how the screen actually groups them, and it cannot grab the wrong row the way a tap on
 * the title can.
 */
function pressRow(title, buttonLabel = 'Arm') {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const head = seek((n) => (n.label ?? '').trim() === title);
    if (!head) {
      console.error(`   !! never found row "${title}"`);
      return false;
    }
    // Buttons sit level with or just under the title they belong to; the next row is ~100pt
    // away, so 70pt is comfortably inside one row and safely outside the next. Both have to
    // be on screen: a partly-scrolled card is the one case where this can grab a neighbour.
    // The same control relabels itself: "Arm" before it is armed, "Armed" after. Matching one
      // literal string meant a fault left armed by an earlier run made this report "no such
      // button" on a row that was plainly there and plainly armed: and the caller then armed
      // nothing, searched, saw results, and accused the app of not injecting faults. Accept the
      // whole label family so an already-armed row is treated as armed, which is what it is.
    const wants = Array.isArray(buttonLabel) ? buttonLabel : [buttonLabel];
    const btn = nodes()
      .filter((n) => n.type === 'Button' && wants.includes((n.label ?? '').trim()) && visible(n))
      .filter((n) => n.rect.y >= head.rect.y - 10 && n.rect.y <= head.rect.y + 70)
      .sort((a, b) => a.rect.y - b.rect.y)[0];
    if (btn) {
      sh(`npx agent-device press "@${btn.ref}" 2>&1`, { allowFail: true });
      sleep(1.2);
      return true;
    }
    // The title is visible but its button is not, which means the card straddles the fold:
    // nudge down half a row and look again.
    sh('npx agent-device swipe 201 500 201 400 --pause-ms 150 2>/dev/null', { allowFail: true });
    sleep(1);
  }
  console.error(`   !! row "${title}" never had a "${buttonLabel}" button beside it`);
  return false;
}

/**
 * Switch tab by name. The keys are the tab labels (`Exercises`, not `exercises`): a wrong
 * case used to produce `tap undefined`, which agent-device rejected as a malformed target and
 * the run died ten minutes in. Case-insensitive so the label is the only spelling to remember,
 * and a loud throw rather than a bad tap.
 */
/**
 * Switch tabs, by LABEL first.
 *
 * The bar is now a real `UITabBarController` (`NativeTabs`), so each destination is a `Button`
 * carrying its own label: which the hand-drawn bar never was; its items were `Other` nodes
 * with no accessible name, and coordinates were the only way to reach them.
 *
 * Coordinates remain as a fallback, and they are no longer quite right: the Liquid Glass bar
 * is a capsule inset from the screen edges, so the centres measured at
 * (62, 131, 200, 270, 340) x 822 rather than the old (50, 125, 201, 277, 352) x 810. The old
 * values still land inside the new hit areas, Profile is the closest call at 12pt off: but
 * only by luck, which is the argument for pressing the label the system now exposes.
 */
function tab(name) {
  const key = Object.keys(TABS).find((k) => k.toLowerCase() === String(name).toLowerCase());
  if (!key) throw new Error(`no such tab "${name}": known: ${Object.keys(TABS).join(', ')}`);
  const button = nodes().find((n) => n.type === 'Button' && (n.label ?? '').trim() === key && n.ref);
  if (button) {
    const out = sh(`npx agent-device press '@${button.ref}' 2>&1`, { allowFail: true });
    if (!/Error|INVALID|FAILED/.test(out)) {
      sleep(1.5);
      return out;
    }
  }
  return sh(`npx agent-device tap ${TABS[key]} 2>&1`, { allowFail: true });
}

/**
 * Read the dev screen's request ledger.
 *
 * Scans rather than snapshots, because the ledger is a variable-length list inside a long
 * scrolling screen and its rows mount and unmount as you pass them. The total is the sum of
 * the per-path rows, not the header's eyebrow, so it does not matter which stop mounted
 * which row: but it does mean the count is of *paths the app has hit*, which is the number
 * the claim is written against.
 *
 * Read it from the dev screen, and take the baseline from the dev screen too: anything the
 * act of reading costs is inside the number, and only cancels if it is on both sides.
 */
function ledger(label) {
  // Walk to the ledger's OWN screen rather than assuming the caller is standing on it. The
  // first version assumed it: the first time a caller read counters after a tab switch,
  // scan() scrolled the *exercise list* hunting for a ledger section that was never there, // paging the list and charging those page fetches to whatever was being measured. The dev
  // screen is what reads the counters, so the dev screen is where the read happens; it sends
  // no requests of its own, so navigating there costs the measurement nothing.
  open('dev', 'Developer');
  // Seek to the ledger's own heading rather than scanning the whole page. A scan is the right
  // tool for "does this text exist anywhere", and the wrong one here: callers read these
  // counters several times a run, and a full scan (bottom, then back to the top) cost more
  // than the navigation step it was there to measure. One pan past the heading is enough, // the group list is short and sits directly under it.
  // ── Walk the whole section from the top, every time ───────────────────────────────────────
  // Not `seek` + a pan. Seek stops at the first match and leaves the list wherever that happened
  // to be, so each read started from a different scroll offset and saw a different subset of a
  // recycling list. Measured, three consecutive reads of one unchanged ledger: total=5, then
  // total=1, then "never came into view". Those are the same screen read from three positions, // and the middle one is the dangerous shape, because a partial read is indistinguishable from
  // a real number and every ceiling here is an upper bound.
  //
  // So: go to the top, then pan down until the section's LAST element is on screen, unioning what
  // each stop mounts. `Refresh counters` is that element: it renders in both the empty and the
  // populated state, and it sits below every LedgerRow: so seeing it is proof the walk went past
  // all the rows rather than stopping among them.
  scrollTop({ max: 8 });
  const seen = new Map();
  const collect = () => {
    for (const n of nodes()) {
      const l = (n.label ?? '').trim();
      if (!l || n.visible === false) continue;
      if (!seen.has(l)) seen.set(l, n);
    }
  };
  const sawEnd = () => [...seen.keys()].some((l) => l === 'Refresh counters');
  collect();
  for (let i = 0; i < 12 && !sawEnd(); i += 1) {
    panDown();
    collect();
  }
  const labels_ = [...seen.keys()];
  if (!sawEnd()) {
    return fail(
      `ledger never came fully into view (reading ${label}): panned to the bottom without ` +
        'reaching "Refresh counters", so any count here would be a partial read.',
    );
  }
  if (!labels_.some((l) => /requests since launch/i.test(l))) {
    return fail(`the dev screen has no request ledger on it at all (reading ${label})`);
  }
  // ── Read one row per a11y label: "/api/v2/x/, 3 requests" ─────────────────────────────────
  // Two earlier versions tried to find the count and put it with the path. First by list order
  // (wrong: iOS reports many of these nodes more than once, so the label after a path is often a
  // duplicate of something else). Then by geometry: same y, larger x (wrong for a dumber reason:
  // there is no count node to find. Probed on device, `×N` appeared in NO snapshot mode: not
  // plain, not `--raw`, not `--no-limit`: while the path beside it did). Both failures showed up
  // the same way, which is the reason this reading is strict: rows vanish silently, `total` reads
  // LOW, and a LOW total is how a real retry loop slips under a ceiling.
  //
  // The count was missing for everyone, including a screen reader, so the fix is in the product
  // (app/dev.tsx `LedgerRow`: one accessible element labelled "path, N requests"), and this reads
  // that label. One node per row, nothing to pair, nothing to lose to a duplicate.
  const rows = new Map();
  for (const l of labels_) {
    const m = /^(\/[^\s,]+), (\d+) requests?$/.exec(l);
    if (!m) continue;
    const [, path, countText] = m;
    const count = Number(countText);
    const prev = rows.get(path);
    if (prev !== undefined && prev !== count) {
      // One path showing two counts in a single read means the frame was torn mid-update, and
      // averaging or picking either would be inventing a number.
      fail(`the ledger shows "${path}" at both ${prev} and ${count} requests in one read: re-read it`);
    }
    rows.set(path, count);
  }
  // A path with no count anywhere is never ignorable, and with `accessible` on the row the only
  // way to see a bare path is for that label to have regressed. Ignoring it would silently lower
  // every total, and every ceiling in this suite is an upper bound.
  const orphans = labels_.filter(
    (l) => /^\/[^\s,]+$/.test(l) && !rows.has(l),
  );
  if (orphans.length) {
    fail(
      `the ledger shows ${orphans.length} path(s) with no count anywhere ` +
        `(${[...new Set(orphans)].join(', ')}). LedgerRow is meant to expose one accessible ` +
        'element per row ("path, N requests"); a bare path means that label is gone: so totals ' +
        'here would be short, and a short total is how a request loop passes a ceiling.',
    );
  }
  if (!rows.size && !/Nothing sent since/.test(labels_.join('\n'))) {
    // Distinguishes "the tab genuinely sent nothing" from "I could not read this screen at all",
    // which is the difference between a pass and a broken harness.
    fail(
      'the ledger produced no rows and did not say "Nothing sent since": either the ledger ' +
        'scrolled out of view or its labels changed shape.',
    );
  }
  const list = [...rows.entries()];
  const total = list.reduce((n, [, c]) => n + c, 0);
  const body = list.length
    ? `total=${total}  ${list.sort((a, b) => a[0].localeCompare(b[0])).map(([p, c]) => `${p} ×${c}`).join('   ')}`
    : '(none sent)';
  console.log(`   ${label.padEnd(22)} ${body}`);
  return { total, rows: list };
}

module.exports = {
  CWD, METRO, TABS, VIEWPORT_HEIGHT, sh, sleep, nodes, labels, visible, onScreen, has, hasAnywhere,
  isNotFound, scan, seek, scrollTop, panDown, panUp, signature, open, fail, pressLabel, pressText,
  pressRow, armFault, waitFor, settle, settleForText, tab, ledger, occluderAt, clearPointIn, pressable, onExit, faultArmed, clearFaultQuietly, restartApp, dbQuery, dbCol, dbExec,
  forceEnglishUI,
  fillField,
  metroAlive,
};
