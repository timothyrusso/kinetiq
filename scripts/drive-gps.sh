#!/bin/bash
# GPS path end to end: start a recording, feed the simulator a running track in the
# background, sample the live panel, then stop and save.
#
# The feed runs as a background job because `agent-device` calls take ~1s each; feeding
# in the foreground would make every sample land seconds after the last position update.
cd /Users/trusso/Desktop/Projects/kinetiq || exit 1
AD="npx agent-device"

shot() {
  $AD snapshot --json 2>/dev/null >/tmp/live.json
  echo -n "  $1: "
  node scripts/metrics-probe.js /tmp/live.json
}

tap_xy() { $AD tap "$1" "$2" >/dev/null 2>&1; }

# Where is the primary button right now?
find_btn() {
  node -e '
    const d = JSON.parse(require("fs").readFileSync("/tmp/live.json","utf8")).data;
    const n = d.nodes.find((n) => (n.label||"").startsWith(process.argv[1]) && n.rect);
    console.log(n ? Math.round(n.rect.x+n.rect.width/2)+" "+Math.round(n.rect.y+n.rect.height/2) : "");
  ' "$1"
}

$AD open "kinetiq://workout/cardio" >/dev/null 2>&1
sleep 3
$AD snapshot --json 2>/dev/null >/tmp/live.json
XY=$(find_btn "Start")
if [ -z "$XY" ]; then echo "!! no Start button — setup panel not shown"; exit 1; fi
echo "tapping Start at $XY"
tap_xy $XY
sleep 3

echo "== feeding GPS =="
./scripts/feed-run.sh 100 >/tmp/feed.log 2>&1 &
FEED=$!

for i in 1 2 3 4 5 6 7 8; do
  shot "t+$((i * 7))"
  sleep 6
done

echo "== stop =="
kill $FEED 2>/dev/null
wait $FEED 2>/dev/null
# controls live below the fold on the live panel
$AD swipe 201 620 201 260 --pause-ms 150 >/dev/null 2>&1
sleep 1
$AD snapshot --json 2>/dev/null >/tmp/live.json
XY=$(find_btn "Stop and save")
if [ -z "$XY" ]; then echo "!! no Stop and save"; exit 1; fi
tap_xy $XY
sleep 4
$AD snapshot --json 2>/dev/null >/tmp/live.json
node -e '
  const d = JSON.parse(require("fs").readFileSync("/tmp/live.json","utf8")).data;
  d.nodes.filter((n) => n.rect && n.rect.y > 200 && n.rect.y < 620 && (n.type === "StaticText" || n.type === "Button"))
    .forEach((n) => console.log("   ", n.type.padEnd(10), (n.label || "·").slice(0, 58)));
'
