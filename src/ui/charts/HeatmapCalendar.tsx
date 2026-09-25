/**
 * The GitHub-style training grid: one square per day, weeks left to right, Monday on top.
 *
 * Weeks as columns and days as rows is the orientation people already know from GitHub; the
 * transpose reads as a calendar and invites misreading. Month labels sit above the week they
 * start in, which keeps them from drifting a column off.
 *
 * ## Sized from its own width
 *
 * The cell size is derived from the measured width, so the grid always fills its card and can
 * never run past the edge the way a fixed 12pt cell did at 26 weeks on a phone. Until the first
 * layout there is no width, and the slot keeps its height so the card does not jump.
 *
 * ## Plain views, one accessible summary
 *
 * About 140 squares are cheap as views in a screen body, and they carry no press handler: a
 * square that can be focused and does nothing is worse than one that cannot. The grid is one
 * accessibility element whose label says what the picture says. Not for list rows.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { withAlpha } from '@/utils/color';
import { Txt } from '../Text';
import { useMeasuredWidth } from './useMeasuredWidth';

export type HeatmapDay = {
  /** Local midnight, or `null` for a day of the current week that has not happened yet. */
  dayStart: number | null;
  /** Minutes trained that day. */
  value: number;
};

const GAP = 3;
const DAY_LABEL_WIDTH = 18;
const MONTH_LABEL_HEIGHT = 16;
/** Rows labelled: Monday, Wednesday, Friday, Sunday. The rest stay blank, as on GitHub. */
const LABELLED_ROWS = new Set([0, 2, 4, 6]);

const MONTH_FORMAT = new Map<string, Intl.DateTimeFormat>();
const WEEKDAY_FORMAT = new Map<string, Intl.DateTimeFormat>();

function monthFormat(locale: string): Intl.DateTimeFormat {
  let fmt = MONTH_FORMAT.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { month: 'short' });
    MONTH_FORMAT.set(locale, fmt);
  }
  return fmt;
}

function weekdayFormat(locale: string): Intl.DateTimeFormat {
  let fmt = WEEKDAY_FORMAT.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
    WEEKDAY_FORMAT.set(locale, fmt);
  }
  return fmt;
}

export const HeatmapCalendar = memo(function HeatmapCalendar({
  days,
  theme,
  locale,
  accessibilityLabel,
  lessLabel,
  moreLabel,
  footer,
  style,
}: {
  /** Oldest first, starting on a Monday, a whole number of weeks long. */
  days: readonly HeatmapDay[];
  theme: Theme;
  /** For month and weekday names, in the app's language rather than the device's. */
  locale: string;
  accessibilityLabel: string;
  lessLabel: string;
  moreLabel: string;
  footer?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, onLayout] = useMeasuredWidth();

  const grid = useMemo(() => {
    const columns: HeatmapDay[][] = [];
    for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));
    const max = days.reduce((acc, d) => Math.max(acc, d.value), 0);

    const months = monthFormat(locale);
    const marks: { index: number; label: string }[] = [];
    let lastMonth = -1;
    columns.forEach((column, index) => {
      const first = column[0]?.dayStart;
      if (first === null || first === undefined) return;
      const month = new Date(first).getMonth();
      if (month === lastMonth) return;
      lastMonth = month;
      // A label needs about three columns of room, or two of them collide.
      if (index - (marks.at(-1)?.index ?? -99) >= 3) marks.push({ index, label: months.format(first) });
    });

    // 2024-01-01 was a Monday, so ISO day n is 2024-01-n.
    const weekdays = weekdayFormat(locale);
    const rowLabels = [0, 1, 2, 3, 4, 5, 6].map((row) =>
      LABELLED_ROWS.has(row) ? weekdays.format(new Date(Date.UTC(2024, 0, row + 1, 12))) : '',
    );
    return { columns, max, marks, rowLabels };
  }, [days, locale]);

  const count = Math.max(1, grid.columns.length);
  const cell = width > 0 ? Math.floor((width - DAY_LABEL_WIDTH - GAP * (count - 1)) / count) : 0;
  const plotHeight = cell > 0 ? cell * 7 + GAP * 6 : 7 * 12 + GAP * 6;

  return (
    <View style={style} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View onLayout={onLayout} style={{ height: MONTH_LABEL_HEIGHT + plotHeight }}>
        {cell > 0 ? (
          <>
            <View style={styles.months}>
              {grid.marks.map((mark) => (
                <Txt
                  key={`m${mark.index}`}
                  variant="micro"
                  tone="faint"
                  numberOfLines={1}
                  style={[styles.month, { left: DAY_LABEL_WIDTH + mark.index * (cell + GAP) }]}
                >
                  {mark.label}
                </Txt>
              ))}
            </View>
            <View style={styles.row}>
              <View style={[styles.dayLabels, { gap: GAP }]}>
                {grid.rowLabels.map((label, row) => (
                  <Txt
                    key={`d${row}`}
                    variant="micro"
                    tone="faint"
                    style={{ height: cell, lineHeight: cell }}
                  >
                    {label}
                  </Txt>
                ))}
              </View>
              <View style={[styles.row, { gap: GAP }]}>
                {grid.columns.map((column, ci) => (
                  <View key={`w${ci}`} style={{ gap: GAP }}>
                    {column.map((day, di) => (
                      <View
                        key={`c${ci}-${di}`}
                        style={[
                          { width: cell, height: cell, borderRadius: radius.xs / 2 },
                          day.dayStart === null
                            ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.hairline }
                            : { backgroundColor: cellColor(level(day.value, grid.max), theme) },
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.legend}>
        <Txt variant="micro" tone="muted" numberOfLines={1} style={styles.footer}>
          {footer ?? ''}
        </Txt>
        <View style={styles.key}>
          <Txt variant="micro" tone="faint">
            {lessLabel}
          </Txt>
          {[0, 1, 2, 3, 4].map((step) => (
            <View key={`k${step}`} style={[styles.keyCell, { backgroundColor: cellColor(step, theme) }]} />
          ))}
          <Txt variant="micro" tone="faint">
            {moreLabel}
          </Txt>
        </View>
      </View>
    </View>
  );
});

/** Five steps, not a continuous scale: a continuous one cannot be read against a five-square key. */
function level(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  const ratio = value / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/** One hue at four strengths, so the ramp follows whatever accent the theme carries. */
const STRENGTH = [0, 0.3, 0.5, 0.75, 1];

function cellColor(step: number, theme: Theme): string {
  // A tint of the text colour rather than a fixed grey, so a rest day reads on whatever card
  // surface the grid sits on, in both modes.
  if (step === 0) return withAlpha(theme.colors.text, theme.mode === 'dark' ? 0.1 : 0.07);
  return withAlpha(theme.colors.accent, STRENGTH[step] ?? 1);
}


const styles = StyleSheet.create({
  months: { height: MONTH_LABEL_HEIGHT },
  month: { position: 'absolute', top: 0 },
  row: { flexDirection: 'row' },
  dayLabels: { width: DAY_LABEL_WIDTH },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  footer: { flex: 1, minWidth: 0 },
  key: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  keyCell: { width: 10, height: 10, borderRadius: radius.xs / 2 },
});
