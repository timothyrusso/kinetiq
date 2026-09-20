#!/bin/bash
# Feed the simulator a plausible *running* track so the GPS path gets tested.
#
# Why not `simctl location <device> simulate "City Run"`: that scenario is a car route at
# tens of m/s. The recorder gates segments at MAX_HUMAN_SPEED_MPS = 8 (src/services/location.ts),
# so every segment would be refused as physically impossible and the route would stay empty
# while the command reported success — a false negative that looks like an app bug.
#
# Step size: at lat 45.07, 0.00004 deg lat is ~4.45 m. One per second is ~4.4 m/s, a real
# run and inside the gate. Accuracy 8 m clears GPS_ACCURACY_FLOOR_M = 24.
UDID="${UDID:-0C66B8BE-737D-4E57-A6DA-4B015C03953E}"
SECONDS_RUN="${1:-90}"
LAT=45.0703
LNG=7.6869

echo "feeding ${SECONDS_RUN}s at ~4.4 m/s (0.00004 deg/s)"
for ((i = 0; i < SECONDS_RUN; i++)); do
  LAT=$(echo "$LAT + 0.00004" | bc -l)
  LNG=$(echo "$LNG + 0.00002" | bc -l)
  xcrun simctl location "$UDID" set "$(printf '%.6f' "$LAT"),$(printf '%.6f' "$LNG")" >/dev/null 2>&1
  sleep 1
done
echo "feed finished"
