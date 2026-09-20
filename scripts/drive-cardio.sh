#!/bin/bash
# Drive the cardio flow end to end and print the live readouts at each step.
# One script, one session: a `metro reload` between steps would discard the very
# recording under test, which is what made earlier readings look impossible.
cd /Users/trusso/Desktop/Projects/kinetiq || exit 1
AD="npx agent-device"

shot() {
  $AD snapshot --json 2>/dev/null >/tmp/live.json
  echo -n "  $1: "
  node scripts/metrics-probe.js /tmp/live.json
}

tap_label() {
  local want="$1"
  local xy
  xy=$(node -e '
    const d = JSON.parse(require("fs").readFileSync("/tmp/live.json","utf8")).data;
    const n = d.nodes.find((n) => (n.label||"").startsWith(process.argv[1]) && n.rect);
    console.log(n ? Math.round(n.rect.x+n.rect.width/2)+" "+Math.round(n.rect.y+n.rect.height/2) : "");
  ' "$want")
  if [ -z "$xy" ]; then echo "  !! no element labelled '$want'"; return 1; fi
  # shellcheck disable=SC2086
  $AD tap $xy 2>&1 | grep -v "^Tapped\|^Swiped\|^$" || true
}

echo "== open cardio =="
$AD open "kinetiq://workout/cardio" >/dev/null 2>&1
sleep 3
shot "setup"

echo "== start =="
tap_label "Start"
sleep 3
shot "t+3"
sleep 5
shot "t+8"
sleep 5
shot "t+13"

echo "== pause =="
tap_label "Pause"
sleep 2
shot "paused"
sleep 4
shot "paused+4 (must not advance)"

echo "== resume =="
tap_label "Resume"
sleep 2
shot "resumed"
sleep 5
shot "resumed+5"

echo "== background 20s =="
xcrun simctl spawn 0C66B8BE-737D-4E57-A6DA-4B015C03953E launchctl submit -l com.apple.springboard -- /System/Library/CoreServices/SpringBoard.app/SpringBoard >/dev/null 2>&1
open -a Simulator >/dev/null 2>&1
xcrun simctl launch --terminate-running-process 0C66B8BE-737D-4E57-A6DA-4B015C03953E com.apple.Preferences >/dev/null 2>&1
sleep 20
xcrun simctl terminate 0C66B8BE-737D-4E57-A6DA-4B015C03953E com.apple.Preferences >/dev/null 2>&1
$AD open "kinetiq://workout/cardio" >/dev/null 2>&1
sleep 4
shot "after 20s away"

echo "== stop and save =="
tap_label "Stop and save"
sleep 3
shot "stopped"
