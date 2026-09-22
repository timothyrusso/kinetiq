/**
 * Route trace: the map without a map.
 *
 * ## Why this is the fallback, and what it is for
 *
 * A tile layer needs an API key and a network. Both fail more often than a fitness app should
 * tolerate: no key configured, airplane mode, a dead cell signal five kilometres from a road, a
 * build without the Maps SDK linked. In every one of those cases the user still recorded a
 * route, and "Map unavailable" throwing away the shape of the run they just did is the worst
 * available answer.
 *
 * This draws the route itself: projected, fitted, pace-coloured: on a plain canvas. It is not
 * a map: there are no streets, so it cannot answer "where was that". It answers "what shape was
 * it, and where did I go hard", which is most of what a route review is for.
 *
 * ## Projection
 *
 * A lat/lng pair is not a point on a plane, and the distortion matters at city scale: at 45°
 * latitude a degree of longitude is ~0.7 of a degree of latitude, so an unprojected route comes
 * out squashed east-west. Scaling longitude by cos(centre latitude): the equirectangular
 * approximation: is exact enough for anything a phone records and costs one multiply.
 */
import { memo, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import type { Theme } from '@/theme/theme';
import type { LatLng, RoutePoint } from '@/domain/types';
import { PACE_RAMP_STOPS, paceColorsForRoute } from '@/ui/pace';
import { withAlpha } from '@/utils/color';
import { Txt } from '@/ui/Text';
import { Row } from '@/ui/layout';
import { spacing } from '@/theme/tokens';
import type { ActivityKind } from '@/domain/types';
import { useT } from '@/i18n/useT';

/** Consecutive points further apart than this (screen px) get a dotted link. */
const GAP_THRESHOLD = 18;

export const RouteTrace = memo(function RouteTrace({
  route,
  kind,
  theme,
  height = 220,
  paceColoured = true,
  showStartEnd = true,
  showLegend = true,
  caption,
  style,
}: {
  route: readonly RoutePoint[];
  kind: ActivityKind;
  theme: Theme;
  height?: number;
  /** Off for a lift/yoga session, where there is no pace to colour by. */
  paceColoured?: boolean;
  showStartEnd?: boolean;
  /**
   * Off when the surrounding card already explains the colours: a map layered over the trace
   * has its own key, and two legends on one route reads like the app is unsure which is real.
   * An explicit `caption` still renders; this only suppresses the automatic ramp and its label.
   */
  showLegend?: boolean;
  /** Under-legend copy, e.g. "Pace: 6:10 slow → 4:20 fast". */
  caption?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useT();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const geometry = useMemo(() => {
    if (width <= 0 || route.length < 2) return null;
    return project(route, width, height);
  }, [height, route, width]);

  const colors = useMemo(
    () => (paceColoured ? paceColorsForRoute(route, kind) : null),
    [kind, paceColoured, route],
  );

  // One variable rather than two near-identical JSX branches: the only difference between a
  // pace-coloured trace and a plain one is whether a default label exists to fall back to.
  const legend = caption ?? (paceColoured && showLegend ? 'Slower → faster' : null);

  if (route.length < 2) {
    return (
      <View style={[styles.empty, { height }, style]}>
        <Txt variant="caption" tone="faint" align="center">
          {t(route.length === 0 ? 'states.noRouteRecorded' : 'states.tooFewFixes')}
        </Txt>
      </View>
    );
  }

  return (
    <View style={[style]}>
      <View
        style={[styles.canvas, { height, backgroundColor: theme.colors.surfaceRaised }]}
        onLayout={onLayout}
      >
        {geometry === null || width <= 0 ? null : (
          <Svg width={width} height={height}>
            {/* Segments drawn individually so each can carry its own colour. A single
                <Polyline> can only be one colour; the chunked alternative would need colour
                runs computed over shared vertices and breaks at the first colour change. */}
            {geometry.points.map((point, i) => {
              if (i === 0) return null;
              const previous = geometry.points[i - 1];
              if (previous === undefined) return null;
              const gap =
                Math.hypot(point.x - previous.x, point.y - previous.y) > GAP_THRESHOLD;
              const color = colors?.[i] ?? theme.colors.accent;
              if (gap) {
                return (
                  <Line
                    key={`gap-${i}`}
                    x1={previous.x}
                    y1={previous.y}
                    x2={point.x}
                    y2={point.y}
                    stroke={theme.colors.textFaint}
                    strokeWidth={2}
                    strokeDasharray="2 5"
                    strokeLinecap="round"
                  />
                );
              }
              return (
                <Line
                  key={`seg-${i}`}
                  x1={previous.x}
                  y1={previous.y}
                  x2={point.x}
                  y2={point.y}
                  stroke={color}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Start and finish in fixed colours, deliberately not pace-coloured: the
                endpoints are locations, not efforts, and giving them ramp hues would put two
                hot pixels at the ends of every route. */}
            {showStartEnd ? (
              <>
                <Endpoint point={geometry.first} color={theme.colors.info} ring />
                <Endpoint point={geometry.last} color={theme.colors.accent} />
              </>
            ) : null}
          </Svg>
        )}
      </View>

      {paceColoured && showLegend ? (
        <Row gap="sm" align="center" style={{ paddingTop: spacing.sm }}>
          {PACE_RAMP_STOPS.map((stop, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: stop,
              }}
            />
          ))}
        </Row>
      ) : null}
      {legend !== null ? (
        <Txt variant="micro" tone="faint" style={{ paddingTop: spacing.xs }}>
          {legend}
        </Txt>
      ) : null}
    </View>
  );
});

function Endpoint({
  point,
  color,
  ring = false,
}: {
  point: { x: number; y: number };
  color: string;
  /** Hollow for the start, solid for the finish: distinguishable without a legend. */
  ring?: boolean;
}) {
  return (
    <>
      <Circle cx={point.x} cy={point.y} r={7} fill={withAlpha(color, 0.22)} />
      {ring ? (
        <Circle
          cx={point.x}
          cy={point.y}
          r={4}
          fill="transparent"
          stroke={color}
          strokeWidth={2}
        />
      ) : (
        <Circle cx={point.x} cy={point.y} r={3.5} fill={color} />
      )}
    </>
  );
}

/* ---------------------------------------------------------------- projection -- */

type Projected = {
  points: { x: number; y: number }[];
  first: { x: number; y: number };
  last: { x: number; y: number };
};

/**
 * Fit a route into `width × height` with padding, preserving aspect ratio.
 *
 * The `cos(lat)` factor is evaluated once at the route's centre latitude rather than per point.
 * Over the few kilometres a workout covers, the cosine changes by less than a part in ten
 * thousand: recomputing it per point would be precision theatre.
 */
function project(route: readonly RoutePoint[], width: number, height: number): Projected | null {
  const coords = route.map((p) => p.coords);
  const bounds = boundsOf(coords);
  if (bounds === null) return null;

  const centreLat = (bounds.minLat + bounds.maxLat) / 2;
  const lonScale = Math.cos((centreLat * Math.PI) / 180) || 1;

  const spanX = (bounds.maxLng - bounds.minLng) * lonScale || 1e-6;
  const spanY = bounds.maxLat - bounds.minLat || 1e-6;

  const pad = 16;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  const points = coords.map(([lat, lng]) => ({
    x: offsetX + (lng - bounds.minLng) * lonScale * scale,
    // Screen y grows downward; latitude grows upward.
    y: offsetY + (bounds.maxLat - lat) * scale,
  }));

  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return null;
  return { points, first, last };
}

function boundsOf(coords: readonly LatLng[]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of coords) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return null;
  return { minLat, maxLat, minLng, maxLng };
}

/* --------------------------------------------------------------- styles -- */

const styles = {
  canvas: { borderRadius: 16, overflow: 'hidden' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
} as const satisfies Record<string, ViewStyle>;
