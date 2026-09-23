/**
 * A settings screen on Android: Material 3 list items in grouped sections.
 *
 * Material has no stepper, so a stepper row is the Material idiom for one: the value between
 * two icon buttons in the trailing slot. A multiple choice is a row with a trailing checkbox,
 * and a text entry is Material's own filled text field.
 *
 * ## Why the sections are drawn here and not by `FieldGroup.Section`
 *
 * Expo UI's `FieldGroup.Section` wraps every child in a `ListItem` of its own and puts the
 * child in that item's headline slot. Every row here IS a `ListItem`, because it needs the
 * supporting and trailing slots, so each row came out as a list item nested in a list item:
 * the Material padding twice over on every side, and the inner item painting its own
 * container over the section's tonal card. So this file draws the same connected-list look
 * itself, one `ListItem` per row: the section title in `titleSmall`, rows on
 * `surfaceContainer` clipped fully round at the ends of a section and slightly round between,
 * a 2dp gap, and the footer in `bodySmall` on `onSurfaceVariant`. The scroll container owns
 * the gutter, per the platform rule.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  Checkbox,
  Column,
  Host,
  Icon,
  IconButton,
  LazyColumn,
  ListItem,
  Row as ComposeRow,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Switch,
  Text,
  TextField,
  useMaterialColors,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { alpha, background, clickable, clip, fillMaxSize, fillMaxWidth, padding, Shapes } from '@expo/ui/jetpack-compose/modifiers';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import { screenGutter, spacing } from '@/theme/tokens';
import { useScreenContentBottom } from '@/ui/insets';
import { materialIcon } from '@/ui/materialIcons';
import type { SettingsListProps, SettingsRow, SettingsSection } from './types';

export type { SettingsListProps, SettingsRow, SettingsSection } from './types';

export function SettingsList({ sections }: SettingsListProps) {
  const theme = useAppTheme();
  const bottom = useScreenContentBottom();
  return (
    <Host style={styles.host} colorScheme={theme.mode} seedColor={theme.colors.accent}>
      <Sections sections={sections} bottom={bottom} />
    </Host>
  );
}

/** Inside the host, so the Material colours are the host's own scheme. */
function Sections({ sections, bottom }: SettingsListProps & { bottom: number }) {
  const colors = useMaterialColors();
  return (
    <LazyColumn
      verticalArrangement={{ spacedBy: spacing.xxl }}
      contentPadding={{ start: screenGutter, end: screenGutter, top: spacing.lg, bottom }}
      modifiers={[fillMaxSize(), background(colors.surface)]}
    >
      {sections.map((section) => (
        <Section key={section.key} section={section} colors={colors} />
      ))}
    </LazyColumn>
  );
}

type MaterialColors = ReturnType<typeof useMaterialColors>;

/** Full at a section's ends, slight between rows: Material 3's connected list. */
const FULL = 20;
const SLIGHT = 4;
/** Section labels and footers line up with the text inside the rows, not the card edge. */
const TEXT_INSET = spacing.lg;

function cornersFor(index: number, count: number) {
  const top = index === 0 ? FULL : SLIGHT;
  const bottom = index === count - 1 ? FULL : SLIGHT;
  return { topStart: top, topEnd: top, bottomStart: bottom, bottomEnd: bottom };
}

function Section({ section, colors }: { section: SettingsSection; colors: MaterialColors }) {
  const count = section.rows.length;
  return (
    <Column verticalArrangement={{ spacedBy: spacing.xs }} modifiers={[fillMaxWidth()]}>
      {section.title ? (
        <Column modifiers={[padding(TEXT_INSET, 0, TEXT_INSET, spacing.xs)]}>
          <Text color={colors.primary} style={{ typography: 'titleSmall' }}>
            {section.title}
          </Text>
        </Column>
      ) : null}
      {count > 0 ? (
        <Column verticalArrangement={{ spacedBy: spacing.xxs }} modifiers={[fillMaxWidth()]}>
          {section.rows.map((row, index) => (
            <Row
              key={row.key}
              row={row}
              colors={colors}
              shape={[fillMaxWidth(), clip(Shapes.RoundedCorner(cornersFor(index, count)))]}
            />
          ))}
        </Column>
      ) : null}
      {section.footer ? (
        <Column modifiers={[padding(TEXT_INSET, spacing.xs, TEXT_INSET, 0)]}>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
            {section.footer}
          </Text>
        </Column>
      ) : null}
    </Column>
  );
}

function Glyph({ name }: { name: 'chevron-right' | 'remove' | 'add' }) {
  const source = materialIcon(name);
  return source ? <Icon source={source} size={24} /> : null;
}

type Modifiers = NonNullable<Parameters<typeof ListItem>[0]['modifiers']>;

const Row = memo(function Row({
  row,
  colors,
  shape,
}: {
  row: SettingsRow;
  colors: MaterialColors;
  /** Width and the position-aware clip, from the section. */
  shape: Modifiers;
}) {
  const item = { containerColor: colors.surfaceContainer };
  switch (row.kind) {
    case 'nav':
      return (
        <ListItem colors={item} modifiers={[...shape, clickable(row.onPress)]}>
          <ListItem.HeadlineContent>
            <Text>{row.title}</Text>
          </ListItem.HeadlineContent>
          {row.subtitle ? (
            <ListItem.SupportingContent>
              <Text>{row.subtitle}</Text>
            </ListItem.SupportingContent>
          ) : null}
          <ListItem.TrailingContent>
            <ComposeRow verticalAlignment="center" horizontalArrangement={{ spacedBy: spacing.sm }}>
              {row.value ? <Text>{row.value}</Text> : null}
              <Glyph name="chevron-right" />
            </ComposeRow>
          </ListItem.TrailingContent>
        </ListItem>
      );
    case 'switch': {
      const toggle = () => {
        if (row.disabled) return;
        haptics.selection();
        row.onChange(!row.value);
      };
      return (
        <ListItem colors={item} modifiers={[...shape, clickable(toggle)]}>
          <ListItem.HeadlineContent>
            <Text>{row.title}</Text>
          </ListItem.HeadlineContent>
          {row.subtitle ? (
            <ListItem.SupportingContent>
              <Text>{row.subtitle}</Text>
            </ListItem.SupportingContent>
          ) : null}
          <ListItem.TrailingContent>
            <Switch value={row.value} enabled={!row.disabled} onCheckedChange={toggle} />
          </ListItem.TrailingContent>
        </ListItem>
      );
    }
    case 'stepper': {
      const move = (delta: number) => {
        const next = Math.min(row.max, Math.max(row.min, row.value + delta));
        if (next === row.value) return;
        haptics.selection();
        row.onChange(next);
      };
      return (
        <ListItem colors={item} modifiers={shape}>
          <ListItem.HeadlineContent>
            <Text>{row.title}</Text>
          </ListItem.HeadlineContent>
          {row.subtitle ? (
            <ListItem.SupportingContent>
              <Text>{row.subtitle}</Text>
            </ListItem.SupportingContent>
          ) : null}
          <ListItem.TrailingContent>
            <ComposeRow verticalAlignment="center">
              <IconButton onClick={() => move(-row.step)} enabled={row.value > row.min}>
                <Glyph name="remove" />
              </IconButton>
              <Text>{row.format(row.value)}</Text>
              <IconButton onClick={() => move(row.step)} enabled={row.value < row.max}>
                <Glyph name="add" />
              </IconButton>
            </ComposeRow>
          </ListItem.TrailingContent>
        </ListItem>
      );
    }
    case 'check': {
      const press = () => {
        haptics.selection();
        row.onPress();
      };
      // A checkbox, not a bare tick: several of these can be on at once (the reminder's days),
      // and in Material a tick alone reads as "the one selected option".
      return (
        <ListItem colors={item} modifiers={[...shape, clickable(press)]}>
          <ListItem.HeadlineContent>
            <Text>{row.title}</Text>
          </ListItem.HeadlineContent>
          <ListItem.TrailingContent>
            <Checkbox value={row.checked} onCheckedChange={press} />
          </ListItem.TrailingContent>
        </ListItem>
      );
    }
    case 'segmented':
      return (
        <ListItem colors={item} modifiers={shape}>
          <ListItem.HeadlineContent>
            <Text>{row.title}</Text>
          </ListItem.HeadlineContent>
          <ListItem.SupportingContent>
            <SingleChoiceSegmentedButtonRow>
              {row.options.map((o) => (
                <SegmentedButton
                  key={o.value}
                  selected={o.value === row.value}
                  onClick={() => {
                    if (o.value === row.value) return;
                    haptics.selection();
                    row.onChange(o.value);
                  }}
                >
                  <SegmentedButton.Label>
                    <Text>{o.label}</Text>
                  </SegmentedButton.Label>
                </SegmentedButton>
              ))}
            </SingleChoiceSegmentedButtonRow>
          </ListItem.SupportingContent>
        </ListItem>
      );
    case 'info':
      return (
        <ListItem colors={item} modifiers={shape}>
          <ListItem.HeadlineContent>
            <Text>{row.title}</Text>
          </ListItem.HeadlineContent>
          {row.subtitle ? (
            <ListItem.SupportingContent>
              <Text>{row.subtitle}</Text>
            </ListItem.SupportingContent>
          ) : null}
          {row.value ? (
            <ListItem.TrailingContent>
              <Text>{row.value}</Text>
            </ListItem.TrailingContent>
          ) : null}
        </ListItem>
      );
    case 'button':
      return (
        <ListItem colors={item} modifiers={row.disabled ? shape : [...shape, clickable(row.onPress)]}>
          <ListItem.HeadlineContent>
            {/* Material's disabled content is the same colour at 38%. Without it a Save that
                cannot save looked exactly like one that can. */}
            <Text
              color={row.destructive ? colors.error : colors.primary}
              modifiers={row.disabled ? [alpha(0.38)] : []}
            >
              {row.title}
            </Text>
          </ListItem.HeadlineContent>
        </ListItem>
      );
    case 'field':
      return <FieldRow row={row} colors={colors} shape={shape} />;
  }
});

function FieldRow({
  row,
  colors,
  shape,
}: {
  row: Extract<SettingsRow, { kind: 'field' }>;
  colors: MaterialColors;
  shape: Modifiers;
}) {
  const text = useNativeState(row.value);
  const last = useRef(row.value);
  useEffect(() => {
    if (row.value !== last.current) {
      last.current = row.value;
      text.value = row.value;
    }
  }, [row.value, text]);
  // On the section's card like every other row, with the field filling it inside the card's
  // own padding, so a form section reads as one group rather than loose fields.
  return (
    <Column
      modifiers={[
        ...shape,
        background(colors.surfaceContainer),
        padding(spacing.lg, spacing.sm, spacing.lg, spacing.sm),
      ]}
    >
      <TextField
        value={text}
        modifiers={[fillMaxWidth()]}
        singleLine
        isError={Boolean(row.error)}
        {...(row.maxLength ? { maxLength: row.maxLength } : {})}
        keyboardOptions={{ keyboardType: row.numeric ? 'number' : 'text' }}
        onValueChange={(next) => {
          last.current = next;
          row.onChangeText(next);
        }}
      >
        <TextField.Label>
          <Text>{row.title}</Text>
        </TextField.Label>
        {row.placeholder ? (
          <TextField.Placeholder>
            <Text>{row.placeholder}</Text>
          </TextField.Placeholder>
        ) : null}
        {row.unit ? (
          <TextField.Suffix>
            <Text>{row.unit}</Text>
          </TextField.Suffix>
        ) : null}
        {row.error ? (
          <TextField.SupportingText>
            <Text>{row.error}</Text>
          </TextField.SupportingText>
        ) : null}
      </TextField>
    </Column>
  );
}

const styles = StyleSheet.create({ host: { flex: 1 } });
