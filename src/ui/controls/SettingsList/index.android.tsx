/**
 * A settings screen on Android: Material 3 list items in grouped sections.
 *
 * Material has no stepper, so a stepper row is the Material idiom for one: the value between
 * two icon buttons in the trailing slot. A multiple choice is a row with a trailing check, and
 * a text entry is Material's own filled text field.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { FieldGroup } from '@expo/ui';
import {
  Host,
  Icon,
  IconButton,
  ListItem,
  Row as ComposeRow,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Switch,
  Text,
  TextField,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { clickable } from '@expo/ui/jetpack-compose/modifiers';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import { materialIcon } from '@/ui/materialIcons';
import type { SettingsListProps, SettingsRow } from './types';

export type { SettingsListProps, SettingsRow, SettingsSection } from './types';

export function SettingsList({ sections }: SettingsListProps) {
  const theme = useAppTheme();
  return (
    <Host style={styles.host} colorScheme={theme.mode} seedColor={theme.colors.accent}>
      <FieldGroup>
        {sections.map((section) => (
          <FieldGroup.Section key={section.key} {...(section.title ? { title: section.title } : {})}>
            {section.rows.map((row) => (
              <Row key={row.key} row={row} danger={theme.colors.danger} />
            ))}
            {section.footer ? (
              <FieldGroup.SectionFooter>
                <Text>{section.footer}</Text>
              </FieldGroup.SectionFooter>
            ) : null}
          </FieldGroup.Section>
        ))}
      </FieldGroup>
    </Host>
  );
}

function Glyph({ name }: { name: 'chevron-right' | 'remove' | 'add' | 'check' }) {
  const source = materialIcon(name);
  return source ? <Icon source={source} size={24} /> : null;
}

const Row = memo(function Row({ row, danger }: { row: SettingsRow; danger: string }) {
  switch (row.kind) {
    case 'nav':
      return (
        <ListItem modifiers={[clickable(row.onPress)]}>
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
        <ListItem modifiers={[clickable(toggle)]}>
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
        <ListItem>
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
    case 'check':
      return (
        <ListItem modifiers={[clickable(row.onPress)]}>
          <ListItem.HeadlineContent>
            <Text>{row.title}</Text>
          </ListItem.HeadlineContent>
          {row.checked ? (
            <ListItem.TrailingContent>
              <Glyph name="check" />
            </ListItem.TrailingContent>
          ) : null}
        </ListItem>
      );
    case 'segmented':
      return (
        <ListItem>
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
        <ListItem>
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
        <ListItem modifiers={row.disabled ? [] : [clickable(row.onPress)]}>
          <ListItem.HeadlineContent>
            <Text {...(row.destructive ? { color: danger } : {})}>{row.title}</Text>
          </ListItem.HeadlineContent>
        </ListItem>
      );
    case 'field':
      return <FieldRow row={row} />;
  }
});

function FieldRow({ row }: { row: Extract<SettingsRow, { kind: 'field' }> }) {
  const text = useNativeState(row.value);
  const last = useRef(row.value);
  useEffect(() => {
    if (row.value !== last.current) {
      last.current = row.value;
      text.value = row.value;
    }
  }, [row.value, text]);
  return (
    <TextField
      value={text}
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
  );
}

const styles = StyleSheet.create({ host: { flex: 1 } });
