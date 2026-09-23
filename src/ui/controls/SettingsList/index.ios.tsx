/**
 * A settings screen on iOS: a SwiftUI `Form`, the grouped inset list Settings itself uses.
 *
 * Each row kind is drawn the way Apple's own settings draw it: navigation rows with a chevron,
 * a `Toggle`, a value beside a `Stepper`, a checkmark row for one of several choices, a
 * segmented `Picker`, `LabeledContent` for a read-only value, a `TextField` for an entry.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  Button,
  Form,
  HStack,
  Host,
  Image,
  LabeledContent,
  Picker,
  Section,
  Spacer,
  Stepper,
  Text,
  TextField,
  Toggle,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  disabled as disabledMod,
  font,
  foregroundStyle,
  keyboardType,
  labelsHidden,
  monospacedDigit,
  multilineTextAlignment,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import type { SettingsListProps, SettingsRow } from './types';

export type { SettingsListProps, SettingsRow, SettingsSection } from './types';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

export function SettingsList({ sections }: SettingsListProps) {
  const theme = useAppTheme();
  return (
    <Host style={styles.host} colorScheme={theme.mode} seedColor={theme.colors.accent}>
      <Form>
        {sections.map((section) => (
          <Section
            key={section.key}
            {...(section.title ? { title: section.title } : {})}
            {...(section.footer ? { footer: <Text>{section.footer}</Text> } : {})}
          >
            {section.rows.map((row) => (
              <Row key={row.key} row={row} accent={theme.colors.accent} />
            ))}
          </Section>
        ))}
      </Form>
    </Host>
  );
}

function Titles({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  return (
    <VStack alignment="leading" spacing={2}>
      <Text>{title}</Text>
      {subtitle ? <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{subtitle}</Text> : null}
    </VStack>
  );
}

const Row = memo(function Row({ row, accent }: { row: SettingsRow; accent: string }) {
  switch (row.kind) {
    case 'nav':
      return (
        <Button onPress={row.onPress} modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
          <HStack spacing={8}>
            <Titles title={row.title} subtitle={row.subtitle} />
            <Spacer />
            {row.value ? <Text modifiers={[secondary]}>{row.value}</Text> : null}
            <Image systemName="chevron.right" modifiers={[font({ textStyle: 'footnote', weight: 'semibold' }), tertiary]} />
          </HStack>
        </Button>
      );
    case 'switch':
      return (
        <Toggle
          isOn={row.value}
          onIsOnChange={(next) => {
            haptics.selection();
            row.onChange(next);
          }}
          modifiers={[disabledMod(row.disabled ?? false)]}
        >
          <Titles title={row.title} subtitle={row.subtitle} />
        </Toggle>
      );
    case 'stepper':
      return (
        <HStack spacing={12}>
          <Titles title={row.title} subtitle={row.subtitle} />
          <Spacer />
          <Text modifiers={[monospacedDigit(), secondary]}>{row.format(row.value)}</Text>
          <Stepper
            label={row.title}
            value={row.value}
            min={row.min}
            max={row.max}
            step={row.step}
            modifiers={[labelsHidden()]}
            onValueChange={(next) => {
              haptics.selection();
              row.onChange(next);
            }}
          />
        </HStack>
      );
    case 'check':
      return (
        <Button onPress={row.onPress} modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
          <HStack>
            <Text>{row.title}</Text>
            <Spacer />
            {row.checked ? <Image systemName="checkmark" modifiers={[foregroundStyle(accent)]} /> : null}
          </HStack>
        </Button>
      );
    case 'segmented':
      return (
        <Picker
          label={row.title}
          selection={row.value}
          onSelectionChange={(next) => {
            haptics.selection();
            row.onChange(String(next));
          }}
          modifiers={[pickerStyle('segmented')]}
        >
          {row.options.map((o) => (
            <Text key={o.value} modifiers={[tag(o.value)]}>
              {o.label}
            </Text>
          ))}
        </Picker>
      );
    case 'info':
      return (
        <LabeledContent label={<Titles title={row.title} subtitle={row.subtitle} />}>
          <Text modifiers={[secondary]}>{row.value ?? ''}</Text>
        </LabeledContent>
      );
    case 'button':
      return (
        <Button
          label={row.title}
          role={row.destructive ? 'destructive' : 'default'}
          onPress={row.onPress}
          modifiers={[disabledMod(row.disabled ?? false)]}
        />
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
    <VStack alignment="leading" spacing={4}>
      <LabeledContent label={row.title}>
        <HStack spacing={4}>
          <TextField
            text={text}
            {...(row.placeholder ? { placeholder: row.placeholder } : {})}
            {...(row.maxLength ? { maxLength: row.maxLength } : {})}
            onTextChange={(next) => {
              last.current = next;
              row.onChangeText(next);
            }}
            modifiers={[
              multilineTextAlignment('trailing'),
              ...(row.numeric ? [keyboardType('numeric')] : []),
            ]}
          />
          {row.unit ? <Text modifiers={[secondary]}>{row.unit}</Text> : null}
        </HStack>
      </LabeledContent>
      {row.error ? (
        <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle({ type: 'color', color: 'red' })]}>
          {row.error}
        </Text>
      ) : null}
    </VStack>
  );
}

const styles = StyleSheet.create({ host: { flex: 1 } });
