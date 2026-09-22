/**
 * Consistency heatmap: the GitHub-style training grid.
 *
 * Weeks run left to right, days top to bottom, which is the orientation people already
 * know; the alternative (days as columns) reads as a calendar and invites misreading. The
 * month labels sit above the week they *start* in, which is the convention that keeps them
 * from drifting a column off.
 *
 * Cells are memoised pressables with an index-derived key. On a 26-week grid that is ~180
 * of them, which is fine in a screen body and would not be inside a FlashList row: so this
 * component is for screen bodies and cards, not list cells.
 */
import { memo, useMemo } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontFamily, radius, spacing } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { useT } from '@/i18n/useT';

const CELL = 12;
const GAP = 3;
const MONTH_LABEL_HEIGHT = 14;
const LEGEND_LABEL_HEIGHT = 16;
const DAY_LABEL_WIDTH = 16;
const DAY_LABELS = ['M', '', 'W', '', 'F', '', 'S'];

export type HeatmapDay = {
  /** Local calendar date, `yyyy-MM-dd`. */
  date: string;
  /** Minutes trained, sessions, or any load measure: only its ratio to `maxValue` is used. */
  value: number;
};

export const HeatmapCalendar = memo(function HeatmapCalendar({
  days,
  theme,
  weeks = 26,
  maxValue,
  label,
  footer,
  onSelectDay,
  style,
}: {
  /** Must be ordered oldest → newest, with no gaps; missing days should arrive as 0. */
  days: HeatmapDay[];
  theme: Theme;
  /** Trailing weeks shown. 26 fits a phone card without horizontal scrolling. */
  weeks?: number;
  /** Defaults to the series max; pass a fixed target so "less than goal" is comparable
   *  across screens and across refreshes. */
  maxValue?: number;
  label?: string;
  footer?: string;
  onSelectDay?: (date: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useT();
  const { columns, monthMarks, max, busiest, best } = useMemo(() => {
    const trailing = days.slice(Math.max(0, days.length - weeks * 7));
    const cols: HeatmapDay[][] = [];
    for (let i = 0; i < trailing.length; i += 7) {
      const chunk = trailing.slice(i, i + 7);
      // A partial trailing week is padded rather than dropped: dropping it would shift
      // every weekday out of its row, and the whole point of a grid is that Monday is
      // always on the same line.
      while (chunk.length < 7) chunk.push({ date: '', value: 0 });
      cols.push(chunk);
    }
    const peak = Math.max(
      maxValue ?? 0,
      trailing.reduce((acc, d) => Math.max(acc, d.value), 0),
      1,
    );
    const marks: Array<{ index: number; label: string }> = [];
    let lastMonth = -1;
    cols.forEach((col, index) => {
      const first = col[0];
      if (!first?.date) return;
      const month = monthOf(first.date);
      if (month !== lastMonth && month >= 0) {
        // Only label a month when its first week has room, or two labels collide.
        if (index === 0 || index - (marks[marks.length - 1]?.index ?? -99) >= 3) {
          marks.push({ index, label: MONTHS[month] ?? '' });
          lastMonth = month;
        }
      }
    });
    // `max` is the *scale ceiling* (it may be a caller's goal, above anything achieved);
    // `busiest` is the honest answer to "hardest day in this range" for the label.
    const busiestValue = trailing.reduce((acc, d) => Math.max(acc, d.value), 0);
    return {
      columns: cols,
      monthMarks: marks,
      max: peak,
      busiest: busiestValue,
      best: countStreak(trailing),
    };
  }, [days, weeks]);

  const width = DAY_LABEL_WIDTH + columns.length * (CELL + GAP);

  if (columns.length === 0) {
    return (
      <View style={[{ paddingVertical: spacing.lg }, style]}>
        <Text style={{ fontFamily: fontFamily.medium, fontSize: 13, color: theme.colors.textFaint }}>
          {t('misc.noHistoryYet')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={style}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={t('misc.heatmapA11y', {
        label: label ?? t('misc.consistencyLabel'),
        // The same expression the visible footer uses: reading "0 giorni di fila" aloud
        // while the card shows "start a streak today" is two answers to one question.
        streak: best > 1 ? t('misc.dayStreak', { count: best }) : t('misc.startStreak'),
        busiest: formatNumber(busiest),
      })}
    >
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: DAY_LABEL_WIDTH }} />
        <View style={{ width: width - DAY_LABEL_WIDTH, height: MONTH_LABEL_HEIGHT, position: 'relative' }}>
          {monthMarks.map((m) => (
            <Text
              // Index is the key: month labels legitimately repeat across a year boundary,
              // and two "Jan"s in the same key space would drop one of them.
              key={`m${m.index}`}
              style={{
                position: 'absolute',
                left: m.index * (CELL + GAP),
                fontFamily: fontFamily.medium,
                fontSize: 10.5,
                color: theme.colors.chartAxis,
              }}
            >
              {m.label}
            </Text>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: DAY_LABEL_WIDTH, gap: GAP, paddingRight: 4 }}>
          {DAY_LABELS.map((d, i) => (
            <Text
              key={`d${i}`}
              style={{
                height: CELL,
                lineHeight: CELL,
                textAlign: 'right',
                fontFamily: fontFamily.medium,
                fontSize: 9.5,
                color: theme.colors.chartAxis,
              }}
            >
              {d}
            </Text>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: GAP }}>
          {columns.map((col, ci) => (
            <View key={`w${ci}`} style={{ gap: GAP }}>
              {col.map((day, di) => (
                <Cell
                  key={`c${ci}-${di}`}
                  date={day.date}
                  value={day.value}
                  max={max}
                  theme={theme}
                  onSelect={onSelectDay}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
          paddingLeft: DAY_LABEL_WIDTH,
          minHeight: LEGEND_LABEL_HEIGHT,
        }}
      >
        <Text
          numberOfLines={1}
          // `flex: 1` with `minWidth: 0`: without them this text takes its natural width and
          // `space-between` has nothing left to distribute, so a long footer runs straight
          // into the Less/More key beside it and renders as "26 settimaneMeno".
          style={{
            flex: 1,
            minWidth: 0,
            marginRight: spacing.md,
            fontFamily: fontFamily.medium,
            fontSize: 11.5,
            color: theme.colors.textMuted,
          }}
        >
          {footer ??
            (best > 1 ? t('misc.dayStreak', { count: best }) : t('misc.startStreak'))}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: fontFamily.medium, fontSize: 10, color: theme.colors.chartAxis }}>
            {t('misc.less')}
          </Text>
          {[0, 1, 2, 3, 4].map((level) => (
            <View
              key={`lg${level}`}
              style={{
                width: 9,
                height: 9,
                borderRadius: radius.xs / 2,
                backgroundColor: cellColor(level, theme),
              }}
            />
          ))}
          <Text style={{ fontFamily: fontFamily.medium, fontSize: 10, color: theme.colors.chartAxis }}>
            {t('misc.more')}
          </Text>
        </View>
      </View>
    </View>
  );
});

const Cell = memo(function Cell({
  date,
  value,
  max,
  theme,
  onSelect,
}: {
  date: string;
  value: number;
  max: number;
  theme: Theme;
  onSelect?: (date: string) => void;
}) {
  const level = intensity(value, max);
  const interactive = Boolean(onSelect) && date.length > 0;
  return (
    // A Pressable rather than raw responder handlers: an accessibilityRole="button" View
    // with no onPress offers VoiceOver an "Activate" that does nothing, which is worse than
    // not being focusable at all.
    <Pressable
      disabled={!interactive}
      onPress={interactive ? () => onSelect?.(date) : undefined}
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={
        interactive ? `${date}: ${formatNumber(value)} of ${formatNumber(max)}` : undefined
      }
      style={{
        width: CELL,
        height: CELL,
        borderRadius: radius.xs / 2,
        // Empty future days and true rest days must not look the same: a placeholder grid
        // square says "not yet", an off cell says "you rested".
        backgroundColor: date.length === 0 ? 'transparent' : cellColor(level, theme),
        borderWidth: date.length === 0 ? 1 : 0,
        borderColor: theme.colors.hairline,
        borderStyle: 'dotted',
      }}
    />
  );
});

/** Five-level ramp. Levels, not a continuous scale: a continuous scale cannot be read
 *  against the five-square legend, which is the only key the chart has. */
function intensity(value: number, max: number): number {
  if (value <= 0) return 0;
  const ratio = value / Math.max(1, max);
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function cellColor(level: number, theme: Theme): string {
  switch (level) {
    case 4:
      return theme.colors.accent;
    case 3:
      return theme.colors.secondary;
    case 2:
      return theme.colors.accentSoft;
    case 1:
      return theme.colors.secondarySoft;
    default:
      return theme.colors.placeholder;
  }
}

function monthOf(iso: string): number {
  const month = Number.parseInt(iso.slice(5, 7), 10);
  return Number.isFinite(month) ? month - 1 : -1;
}

/** Consecutive trailing days with a non-zero value. */
function countStreak(days: HeatmapDay[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i];
    if (!day || day.date.length === 0) break;
    if (day.value <= 0) break;
    streak += 1;
  }
  return streak;
}

function formatNumber(v: number): string {
  return v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type HeatmapCalendarProps = React.ComponentProps<typeof HeatmapCalendar>;
