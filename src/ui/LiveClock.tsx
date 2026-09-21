/**
 * The date and the time, to the second.
 *
 * ## Why this is its own component
 *
 * It re-renders once a second, so everything that does NOT need to re-render once a second has
 * to live outside it. Placed inline in the Home hero, that tick would re-render the hero, its
 * badges, and whatever the hero is a child of. Isolated, the tick touches two `Txt` nodes.
 *
 * ## Why it does not tick in the background
 *
 * An interval that keeps firing while the app is backgrounded is pure battery cost: nobody can
 * see the result, and the value is derivable from the clock the moment anyone looks again. So
 * the interval is cleared on `background` and the time is re-read on `active`, which also fixes
 * the drift a long suspension would otherwise leave behind. A clock that resumes showing the
 * time it was suspended at is worse than no clock.
 *
 * ## Why the interval is not 1000ms
 *
 * A one-second interval started at an arbitrary moment lands mid-second, so the displayed second
 * changes up to 999ms late and the seconds appear to stutter. Each tick schedules the next one
 * for the top of the following second instead.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { Txt } from './Text';

/** Locale-aware, and rebuilt only when the locale changes rather than on every tick. */
function formatters(locale: string) {
  return {
    date: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
    time: new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  };
}

export const LiveClock = memo(function LiveClock({
  locale = 'en-GB',
  align = 'left',
}: {
  locale?: string;
  align?: 'left' | 'right' | 'center';
}) {
  const [now, setNow] = useState(() => new Date());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fmt = useRef(formatters(locale));
  if (fmt.current === undefined) fmt.current = formatters(locale);

  useEffect(() => {
    fmt.current = formatters(locale);
  }, [locale]);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };

    /** Schedules the next update for the top of the next second, not one second from now. */
    const schedule = () => {
      stop();
      const ms = 1000 - (Date.now() % 1000);
      timer.current = setTimeout(() => {
        if (cancelled) return;
        setNow(new Date());
        schedule();
      }, ms);
    };

    const onStateChange = (state: string) => {
      if (state === 'active') {
        // Re-read before scheduling: a suspension of any length leaves the last rendered value
        // stale, and the first thing a returning user looks at is the wrong time.
        setNow(new Date());
        schedule();
      } else {
        stop();
      }
    };

    schedule();
    const sub = AppState.addEventListener('change', onStateChange);
    return () => {
      cancelled = true;
      stop();
      sub.remove();
    };
  }, []);

  const items = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';

  return (
    <View style={{ alignItems: items, gap: spacing.xxs }}>
      <Txt variant="mono" tone="muted" accessibilityLabel={`Time ${fmt.current.time.format(now)}`}>
        {fmt.current.time.format(now)}
      </Txt>
      <Txt variant="caption" tone="faint" uppercase tracking={0.6}>
        {fmt.current.date.format(now)}
      </Txt>
    </View>
  );
});
