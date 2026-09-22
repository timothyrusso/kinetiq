/**
 * RouteMap: the route on a map, over the trace that backs it.
 *
 * ## Two layers, deliberately
 *
 * The map draws tiles; the trace draws the line. The trace is mounted first and unconditionally,
 * and the map is layered on top of it only when it can genuinely render. The reason is the
 * brief's own constraint: an unavailable map must degrade, not break. A screen whose only route
 * affordance is a `MapView` shows a grey rectangle to anyone offline, on a device whose Maps SDK
 * cannot start, or in a build with no key: and none of those are distinguishable from "your
 * route was not saved".
 *
 * Keeping the trace mounted *underneath* rather than switching between `map ? A : B` costs an
 * invisible SVG. What it buys is that a mid-session failure: tiles stopping, the SDK throwing
 * after a backgrounding: reveals something meaningful on the same frame, with no remount of two
 * different native view trees at exactly the moment the app is least stable.
 *
 * ## The key situation, stated plainly
 *
 * Kinetiq ships no Google Maps key, and the vendored config plugin removes the Android
 * `API_KEY` metadata when none is supplied: so `PROVIDER_GOOGLE` on Android is a guaranteed
 * runtime failure, and there is no key to pass anyway. iOS therefore uses Apple Maps, which
 * needs no key and honours `userInterfaceStyle`. Android gets the trace: the shape, the pace
 * colours and the endpoints, which is most of what a map was there to communicate.
 *
 * ## The pace line
 *
 * `strokeColors` requires exactly one colour per coordinate, so the line and its colours come
 * from one `useMemo`. Two independent memos computing the same thinning is how you get a length
 * mismatch, and a length mismatch is a native-side rendering fault, not a warning.
 */
import MapView, { Marker, Polyline } from 'react-native-maps';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Button } from '@/ui/controls/Button';
import { Row } from '@/ui/layout';
import { RouteTrace } from '@/ui/charts/RouteTrace';
import { Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { paceColorsForRoute, PACE_RAMP_MID, PACE_RAMP_STOPS } from '@/ui/pace';
import { radius, spacing } from '@/theme/tokens';
import { isNativePlatform, type Theme } from '@/theme/theme';
import { regionForRoute, resampleRoute } from '@/utils/geometry';
import { withAlpha } from '@/utils/color';
import type { ActivityKind, RoutePoint } from '@/domain/types';
import { useT } from '@/i18n/useT';

/** Points in a rendered line. Above this the gesture thread pays for tesselation nobody sees. */
const MAX_RENDERED_POINTS = 400;

/** How long to wait for the native map to report ready before settling on the trace. */
const MAP_READY_TIMEOUT_MS = 6000;

/**
 * Whether a tile layer can be drawn in this build. Platform-derived, because it is a
 * configuration fact rather than a preference: see the header for why Android has no key.
 */
const MAPS_ENABLED = Platform.OS === 'ios';

export const RouteMap = memo(function RouteMap({
  route,
  kind,
  theme,
  height = 260,
  interactive = true,
  style,
}: {
  route: readonly RoutePoint[];
  kind: ActivityKind;
  theme: Theme;
  height?: number;
  /** False inside a card in a scrolling list: a map that eats the pan gesture is unusable there. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useT();
  const [size, setSize] = useState({ width: 0, height });
  const [mapFailed, setMapFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // The user's own choice, kept separate from `mapFailed` so a failure can be retried without
  // silently overriding someone who asked for the plain route.
  const [traceOnly, setTraceOnly] = useState(false);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height: h } = event.nativeEvent.layout;
    setSize((current) =>
      Math.abs(current.width - width) < 1 && Math.abs(current.height - h) < 1
        ? current
        : { width, height: h },
    );
  }, []);

  /**
   * The thinned coordinates, their colours, and the region that frames them: from one memo.
   *
   * Thinning happens here rather than upstream because the trace needs the *full* route: a pace
   * colour is a distance-over-time between neighbours, so computing it on a 4×-thinned route
   * would report four times the effort at every point and paint an even run as a sprint.
   */
  const line = useMemo(() => {
    if (route.length < 2) return null;
    const keep = resampleRoute(
      route.map((p) => p.coords),
      MAX_RENDERED_POINTS,
    );
    const coordinates = keep.map(([latitude, longitude]) => ({ latitude, longitude }));
    const colors = keep.map((_, i) => paceColourAt(route, i, keep.length, kind));
    const region = regionForRoute(keep, { width: size.width, height: size.height });
    return { coordinates, colors, region };
  }, [kind, route, size.height, size.width]);

  const start = route[0];
  const finish = route[route.length - 1];
  // Strength and yoga have recorded positions but no meaningful pace, so the trace there is a
  // single colour: colouring it would imply the gym lap was slow.
  const traceColoured = kind === 'run' || kind === 'ride' || kind === 'walk';

  const mapWanted =
    MAPS_ENABLED &&
    isNativePlatform &&
    interactive &&
    !traceOnly &&
    line !== null &&
    line.region !== null;

  // react-native-maps 1.27 has no error callback for the iOS map, so an SDK that never comes up
  // can only be detected by `onMapReady` not arriving. Six seconds is generous for a cold tile
  // fetch on a bad connection and short enough that nobody stares at a grey box for longer. The
  // clock only runs while a map is actually wanted, so choosing "Route only" stops it.
  useEffect(() => {
    if (!mapWanted || mapReady || mapFailed) return;
    const timer = setTimeout(() => {
      if (mounted.current) setMapFailed(true);
    }, MAP_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mapFailed, mapReady, mapWanted]);

  const mapUsable = mapWanted && !mapFailed;

  return (
    <View style={style}>
      <View
        onLayout={onLayout}
        style={[styles.frame, { height, backgroundColor: theme.colors.surfaceRaised }]}
      >
        <RouteTrace
          route={route}
          kind={kind}
          theme={theme}
          height={height}
          paceColoured={traceColoured}
          // The map already shows what a pin means; the key below the frame says the rest.
          showLegend={false}
          style={styles.absolute}
        />

        {mapUsable && line !== null && line.region !== null ? (
          <MapView
            style={styles.fill}
            initialRegion={line.region}
            userInterfaceStyle={theme.mode}
            scrollEnabled={interactive}
            zoomEnabled={interactive}
            pitchEnabled={false}
            rotateEnabled={false}
            showsUserLocation={false}
            showsCompass={false}
            showsBuildings={false}
            loadingEnabled
            onMapReady={() => setMapReady(true)}
          >
            <Polyline
              coordinates={line.coordinates}
              strokeColors={line.colors}
              // Used only where gradient strokes are unsupported; a solid accent line is still
              // a route, which is the point of the whole file.
              strokeColor={theme.colors.accent}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
            {start !== undefined ? (
              <Marker
                coordinate={{ latitude: start.coords[0], longitude: start.coords[1] }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <Pin colour={theme.colors.info} hollow />
              </Marker>
            ) : null}
            {finish !== undefined && finish !== start ? (
              <Marker
                coordinate={{ latitude: finish.coords[0], longitude: finish.coords[1] }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <Pin colour={theme.colors.accent} />
              </Marker>
            ) : null}
          </MapView>
        ) : null}

        {/* A status chip, not a control: it names what is being drawn, and only ever appears
            when there are (or were) two things to choose between. */}
        {interactive && (mapUsable || mapFailed) ? (
          <View style={[styles.badge, { backgroundColor: theme.colors.overlay }]}>
            <Icon name={mapFailed ? 'offline' : 'mapPin'} size={11} color={theme.colors.textMuted} />
            <Txt variant="micro" tone="faint">
              {mapFailed ? 'Offline view' : 'Map'}
            </Txt>
          </View>
        ) : null}
      </View>

      {traceColoured ? (
        <Row gap="sm" align="center" style={{ paddingTop: spacing.md }}>
          {PACE_RAMP_STOPS.map((stop, i) => (
            <View key={i} style={[styles.ramp, { backgroundColor: stop }]} />
          ))}
          <Txt
            variant="micro"
            tone="faint"
            numberOfLines={1}
            style={{ flex: 1, minWidth: 0, marginLeft: spacing.xs }}
          >
            Slower → faster
          </Txt>
          {interactive && (MAPS_ENABLED || mapFailed) ? (
            <Button
              label={mapUsable ? 'Route only' : mapFailed ? 'Retry map' : 'Show map'}
              size="sm"
              variant="quiet"
              onPress={() => {
                if (mapFailed) {
                  setMapFailed(false);
                  setTraceOnly(false);
                  return;
                }
                setTraceOnly((current) => !current);
              }}
            />
          ) : null}
        </Row>
      ) : mapFailed ? (
        <Txt variant="micro" tone="faint" style={{ paddingTop: spacing.sm }}>
          {t('misc.mapFailed')}
        </Txt>
      ) : null}
    </View>
  );
});

/* ------------------------------------------------------------------ pieces -- */

function Pin({ colour, hollow = false }: { colour: string; hollow?: boolean }) {
  return (
    <View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: hollow ? withAlpha(colour, 0.25) : colour,
        borderWidth: 2.5,
        borderColor: hollow ? colour : '#FFFFFF',
      }}
    />
  );
}

/**
 * Pace colour for a point on the *thinned* line, computed from the full-resolution route.
 *
 * `resampleRoute` is uniform over arc length, so mapping thinned index *i* back to the full
 * route by proportional index lands on the position it represents to within one sample. The
 * colour is then taken from the full-resolution neighbourhood around that point, which is the
 * only place the segment's real distance and time still exist.
 */
function paceColourAt(
  route: readonly RoutePoint[],
  thinIndex: number,
  thinCount: number,
  kind: ActivityKind,
): string {
  const anchor = Math.round((thinIndex / Math.max(1, thinCount - 1)) * (route.length - 1));
  const from = Math.max(0, anchor - 1);
  const window = route.slice(from, Math.min(route.length, anchor + 2));
  const colours = paceColorsForRoute(window, kind);
  return colours[Math.min(anchor - from, colours.length - 1)] ?? PACE_RAMP_MID;
}

/* ------------------------------------------------------------------ styles -- */

const styles = {
  frame: { borderRadius: radius.lg, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  absolute: { position: 'absolute', left: 0, right: 0, top: 0 },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
  },
  ramp: { width: 18, height: 4, borderRadius: 2 },
} as const satisfies Record<string, ViewStyle>;
