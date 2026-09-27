import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import { Row } from '@/features/core/design-system/layout/Row';
import { Stack } from '@/features/core/design-system/layout/Stack';

/** 2/3/4-up metric grid. `columns` is explicit because a grid that reflows
 * unpredictably makes a dashboard impossible to scan by eye position. */
export const MetricGrid = memo(function MetricGrid({
  children,
  columns = 2,
}: {
  children: ReactNode[];
  columns?: 2 | 3 | 4;
}) {
  const rows: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += columns) {
    rows.push(children.slice(i, i + columns));
  }
  return (
    <Stack gap="md">
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cells are laid out by position, never reordered
        <Row key={i} gap="md">
          {row.map((cell, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: cells are laid out by position, never reordered
            <View key={j} style={{ flex: 1, minWidth: 0 }}>
              {cell}
            </View>
          ))}
          {
            // NOTE: padding cells keep the last row's columns aligned with the others;
            // without them a 3-in-2 grid left-aligns its orphan at full width.
            row.length < columns
              ? Array.from({ length: columns - row.length }, (_, k) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: padding cells have no identity but their position
                  <View key={`pad-${k}`} style={{ flex: 1 }} />
                ))
              : null
          }
        </Row>
      ))}
    </Stack>
  );
});
