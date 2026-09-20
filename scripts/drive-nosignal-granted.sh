#!/bin/bash
# Permission granted, but no usable GPS: the recording must report a missing signal
# after the grace period, and say so with exactly one message.
cd /Users/trusso/Desktop/Projects/kinetiq || exit 1
AD="npx agent-device"
U=0C66B8BE-737D-4E57-A6DA-4B015C03953E

xcrun simctl privacy "$U" revoke location app.kinetiq.mobile >/dev/null 2>&1
xcrun simctl privacy "$U" grant location app.kinetiq.mobile >/dev/null 2>&1
xcrun simctl location "$U" clear >/dev/null 2>&1
# Granting kills the process, so relaunch rather than reuse it.
$AD open Kinetiq --relaunch --foreground --metro-host 127.0.0.1 --metro-port 8083 >/dev/null 2>&1
sleep 9
$AD open "kinetiq://workout/cardio" >/dev/null 2>&1
sleep 3

$AD snapshot --json 2>/dev/null >/tmp/live.json
XY=$(node -e '
  const d = JSON.parse(require("fs").readFileSync("/tmp/live.json","utf8")).data;
  const n = d.nodes.find((n) => (n.label||"") === "Start" && n.rect);
  console.log(n ? Math.round(n.rect.x+n.rect.width/2)+" "+Math.round(n.rect.y+n.rect.height/2) : "");
')
[ -z "$XY" ] && { echo "!! no Start button"; exit 1; }
$AD tap $XY >/dev/null 2>&1

report() {
  $AD snapshot --json 2>/dev/null >/tmp/live.json
  node -e '
    const d = JSON.parse(require("fs").readFileSync("/tmp/live.json","utf8")).data;
    const msgs = d.nodes.filter((n) => n.type === "StaticText" && /estimated from time|Waiting for a GPS/i.test(n.label || ""));
    const has = (re) => d.nodes.some((n) => re.test(n.label || ""));
    console.log("  " + process.argv[1] +
      "  banner=" + has(/Recording, with limits/) +
      "  messages=" + msgs.length +
      " [" + msgs.map((m) => (m.label || "").slice(0, 34)).join(" | ") + "]");
  ' "$1"
}

report "t+6"
sleep 15
report "t+21"
sleep 15
report "t+36"
