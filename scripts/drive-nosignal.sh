#!/bin/bash
# A recording with permission granted but no usable GPS must say so.
# The simulator streams no fixes to watchPositionAsync, which is exactly the
# silent-GPS condition this checks — no feed needed.
cd /Users/trusso/Desktop/Projects/kinetiq || exit 1
AD="npx agent-device"
xcrun simctl location 0C66B8BE-737D-4E57-A6DA-4B015C03953E clear >/dev/null 2>&1

$AD open "kinetiq://workout/cardio" >/dev/null 2>&1
sleep 3
$AD snapshot --json 2>/dev/null >/tmp/live.json
XY=$(node -e '
  const d = JSON.parse(require("fs").readFileSync("/tmp/live.json","utf8")).data;
  const n = d.nodes.find((n) => (n.label||"") === "Start" && n.rect);
  console.log(n ? Math.round(n.rect.x+n.rect.width/2)+" "+Math.round(n.rect.y+n.rect.height/2) : "");
')
[ -z "$XY" ] && { echo "!! no Start"; exit 1; }
$AD tap $XY >/dev/null 2>&1

report() {
  $AD snapshot --json 2>/dev/null >/tmp/live.json
  node -e '
    const d = JSON.parse(require("fs").readFileSync("/tmp/live.json","utf8")).data;
    const has = (re) => d.nodes.some((n) => re.test(n.label || ""));
    console.log("  " + process.argv[1] +
      "  limits-banner=" + has(/Recording, with limits/) +
      "  no-signal-msg=" + has(/signal|satellite|indoor|tunnel/i) +
      "  try-again=" + has(/^Try location again$/));
  ' "$1"
}

report "t+6 (inside grace)"
sleep 12
report "t+18 (inside grace)"
sleep 12
report "t+30 (grace elapsed)"
sleep 12
report "t+42 (still elapsed)"
