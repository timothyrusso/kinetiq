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
 *   - A SNAPSHOT LISTS WHAT IS MOUNTED, NOT WHAT IS ON SCREEN — and RN recycles aggressively.
 *     Measured on the dev screen: a freshly-opened list reports 66 nodes with no ledger
 *     section in them at all (never mounted); one pan mounts it; two more reaches the bottom,
 *     where it reports `Grouped by path` at y = -31 (mounted, scrolled above the viewport);
 *     pan back up and most of it unmounts again. So `snapshot contains "Reset"` is not a
 *     question with a stable yes/no answer — it depends where you last scrolled. Everything
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
// Tab-bar centres from a snapshot, not guessed. The items are `Other` nodes, so they cannot
// be pressed by label and must be tapped by coordinate.
const TABS = { Home: '50 810', Activities: '125 810', Workout: '201 810', Exercises: '277 810', Profile: '352 810' };
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

function nodes() {
  try {
    return (JSON.parse(sh('npx agent-device snapshot --json 2>/dev/null')).data ?? {}).nodes ?? [];
  } catch {
    return [];
  }
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

/** Nodes that are both on screen and carrying the given text, in render order. */
const onScreen = (text) => nodes().filter((n) => (n.label ?? '').includes(text) && visible(n));

/** Labels of everything visible right now. */
const labels = () => nodes().filter((n) => n.label && visible(n)).map((n) => n.label.trim());

/**
 * "Is this text on this screen?" — scrolling top to bottom to find out.
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
  return { text: [...seen].join('  '), stops: stops + 1 };
}

/** True if any of the needles appears anywhere on the screen, scrolling to look for it. */
function hasAnywhere(...needles) {
  const { text } = scan();
  return needles.every((needle) => text.includes(needle));
}

/** "Is this visible without touching anything?" — for polling a screen you are already on. */
const has = (...needles) => {
  const t = labels();
  return needles.every((needle) => t.some((x) => x.includes(needle)));
};

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

// Finger travels UP the screen to move content up, i.e. to reveal what is below.
function panDown() {
  sh('npx agent-device swipe 201 620 201 340 --pause-ms 150 2>/dev/null', { allowFail: true });
  sleep(1);
}
// And the reverse, to get back to what we panned past.
function panUp() {
  sh('npx agent-device swipe 201 340 201 620 --pause-ms 150 2>/dev/null', { allowFail: true });
  sleep(1);
}

/** Walk back to the top, so a scan starts from a known place. */
function scrollTop({ max = 12 } = {}) {
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
 * is *behind* you, and swiping up — which is what "keep scrolling to find it" looks like —
 * moves it further away. So: if a match exists above the viewport, pan up; otherwise pan
 * down until either it becomes visible, or a pan changes nothing and it is genuinely absent.
 */
function seek(want, { max = 14 } = {}) {
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
 * (a real bug — fail).
 *
 * `expectText` is a viewport read first and a full scan only as a fallback. Leading with a
 * scan was correct in principle — a screen whose hero is mounted but whose content is still
 * arriving should not be called landed — and ruinous in practice: a scan walks a list to its
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
function open(route, expectText, { scan: allowScan = false } = {}) {
  let recoveredMenu = false;
  let recoveredPicker = false;
  sh(`npx agent-device open "kinetiq://${route}" ${METRO} 2>&1`, { allowFail: true });
  for (let i = 0; i < 10; i += 1) {
    const t = labels();
    if (t.some((x) => /DEVELOPMENT SERVERS|RECENTLY OPENED/.test(x))) {
      if (recoveredPicker) return fail(`still on the dev-server picker after reconnecting to 8083`);
      recoveredPicker = true;
      console.log('   app is on the dev-server picker — reconnecting to 8083');
      sh(`npx agent-device press 'text^="http://127.0.0.1:8083"' 2>&1`, { allowFail: true });
      sleep(18);
      continue;
    }
    if (onDevMenu()) {
      if (recoveredMenu) return fail('expo dev menu returned after being dismissed — investigate');
      recoveredMenu = true;
      console.log('   expo dev menu is covering the app — dismissing it');
      dismissDevMenu();
      sh(`npx agent-device open "kinetiq://${route}" ${METRO} 2>&1`, { allowFail: true });
      sleep(4);
      continue;
    }
    // Not-found is a verdict, not a retry: the route is genuinely unrouted, and looping ten
    // times waiting for a hero that will never mount just wastes a minute before saying so.
    if (has("Sorry, we couldn't find the page")) {
      return fail(`"${route}" resolved to the not-found screen — unrouted deep link`);
    }
    if (!expectText || has(expectText) || (allowScan && i >= 2 && hasAnywhere(expectText))) {
      return true;
    }
    sleep(2);
  }
  console.error(`   !! never saw "${expectText}" after opening "${route}"`);
  return false;
}

function fail(msg) {
  console.error(`   !! ${msg}`);
  process.exit(1);
}

/**
 * Press a real button by its label, scrolling to it first.
 *
 * Also accepts a selector string (`text^="…"`) for the cases where a label is ambiguous —
 * a routine row and its own title node share text, and `label="X"` throws AMBIGUOUS_MATCH.
 */
function pressLabel(label) {
  const want = label.startsWith('text') || label.startsWith('role')
    ? (n) => (n.label ?? '').includes(label.split('"')[1] ?? '')
    : (n) => (n.label ?? '').trim() === label;
  if (label.startsWith('text') || label.startsWith('role')) {
    // Let agent-device disambiguate itself where it can, once, before falling back.
    const out = sh(`npx agent-device press '${label}' 2>&1`, { allowFail: true });
    if (!/Error|INVALID|FAILED|AMBIGUOUS/.test(out)) {
      sleep(1.2);
      return true;
    }
  }
  const node = seek(want);
  if (!node?.ref) {
    console.error(`   !! never found "${label}" on screen`);
    return false;
  }
  const out = sh(`npx agent-device press "@${node.ref}" 2>&1`, { allowFail: true });
  if (/Error|INVALID|FAILED/.test(out)) {
    console.error(`   !! press "${label}": ${(out.split('\n').find((l) => /Error/.test(l)) ?? out).trim()}`);
    return false;
  }
  sleep(1.2);
  return true;
}

/**
 * Tap the centre of whatever shows this text.
 *
 * The fallback for pressables that are not exposed as buttons at all — the fault rows on
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
 * *row*. Matching by geometry — the nearest such button below the title, both on screen —
 * is how the screen actually groups them, and it cannot grab the wrong row the way a tap on
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
    // be on screen — a partly-scrolled card is the one case where this can grab a neighbour.
    const btn = nodes()
      .filter((n) => n.type === 'Button' && (n.label ?? '').trim() === buttonLabel && visible(n))
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
 * Switch tab by name. The keys are the tab labels (`Exercises`, not `exercises`) — a wrong
 * case used to produce `tap undefined`, which agent-device rejected as a malformed target and
 * the run died ten minutes in. Case-insensitive so the label is the only spelling to remember,
 * and a loud throw rather than a bad tap.
 */
function tab(name) {
  const key = Object.keys(TABS).find((k) => k.toLowerCase() === String(name).toLowerCase());
  if (!key) throw new Error(`no such tab "${name}" — known: ${Object.keys(TABS).join(', ')}`);
  return sh(`npx agent-device tap ${TABS[key]} 2>&1`, { allowFail: true });
}

/**
 * Read the dev screen's request ledger.
 *
 * Scans rather than snapshots, because the ledger is a variable-length list inside a long
 * scrolling screen and its rows mount and unmount as you pass them. The total is the sum of
 * the per-path rows, not the header's eyebrow, so it does not matter which stop mounted
 * which row — but it does mean the count is of *paths the app has hit*, which is the number
 * the claim is written against.
 *
 * Read it from the dev screen, and take the baseline from the dev screen too: anything the
 * act of reading costs is inside the number, and only cancels if it is on both sides.
 */
function ledger(label) {
  // Walk to the ledger's OWN screen rather than assuming the caller is standing on it. The
  // first version assumed it: the first time a caller read counters after a tab switch,
  // scan() scrolled the *exercise list* hunting for a ledger section that was never there —
  // paging the list and charging those page fetches to whatever was being measured. The dev
  // screen is what reads the counters, so the dev screen is where the read happens; it sends
  // no requests of its own, so navigating there costs the measurement nothing.
  open('dev', 'Developer');
  // Seek to the ledger's own heading rather than scanning the whole page. A scan is the right
  // tool for "does this text exist anywhere", and the wrong one here: callers read these
  // counters several times a run, and a full scan (bottom, then back to the top) cost more
  // than the navigation step it was there to measure. One pan past the heading is enough —
  // the group list is short and sits directly under it.
  if (!seek((n) => /Grouped by path|Nothing sent since/.test(n.label ?? ''))) {
    return fail(`ledger never came into view (reading ${label})`);
  }
  const found = new Set(labels());
  panDown();
  for (const l of labels()) found.add(l);
  // Rows appear in mount order, path then count.
  const t = [...found].join('  ').split(/\s{2,}/);
  const rows = new Map();
  for (let i = 0; i < t.length; i += 1) {
    // LedgerRow renders the path, then ×count as the next label (app/dev.tsx:499).
    if (/^\//.test(t[i]) && /^×\d+$/.test(t[i + 1] ?? '')) rows.set(t[i], Number(t[i + 1].slice(1)));
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
  scan, seek, scrollTop, panDown, panUp, signature, open, fail, pressLabel, pressText, pressRow,
  tab, ledger,
};
